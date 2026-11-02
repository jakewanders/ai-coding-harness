import type { z } from 'zod';
import type { ConfigError } from '../contracts/header.js';
import { upgradeLegacyConfig } from './legacy.js';
import { HarnessConfigSchema, type HarnessConfig } from './schema.js';
import { lineOfPath, type LocatedDocument } from './yaml.js';

export const MIGRATION_NOTE = 'run `system config` to migrate';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// ---- zod shape walking, for valid_keys ---------------------------------------

type Def = { type: string; shape?: Record<string, z.ZodTypeAny>; innerType?: z.ZodTypeAny; valueType?: z.ZodTypeAny; element?: z.ZodTypeAny };

function defOf(schema: z.ZodTypeAny): Def {
  return (schema as unknown as { _zod: { def: Def } })._zod.def;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  let s = schema;
  for (;;) {
    const d = defOf(s);
    if ((d.type === 'optional' || d.type === 'nullable' || d.type === 'default') && d.innerType) s = d.innerType;
    else return s;
  }
}

/** Schema node reached by following `segments` through objects, records and arrays. */
function schemaAt(root: z.ZodTypeAny, segments: Array<string | number>): z.ZodTypeAny | null {
  let s: z.ZodTypeAny | null = unwrap(root);
  for (const seg of segments) {
    if (!s) return null;
    const d = defOf(s);
    if (d.type === 'object' && d.shape) s = d.shape[String(seg)] ?? null;
    else if (d.type === 'record' && d.valueType) s = d.valueType;
    else if (d.type === 'array' && d.element) s = d.element;
    else return null;
    if (s) s = unwrap(s);
  }
  return s;
}

/** Keys allowed at the object found at `segments`, or undefined if not an object. */
export function validKeysAt(root: z.ZodTypeAny, segments: Array<string | number>): string[] | undefined {
  const s = schemaAt(root, segments);
  if (!s) return undefined;
  const d = defOf(s);
  return d.type === 'object' && d.shape ? Object.keys(d.shape) : undefined;
}

// ---- layer validation ---------------------------------------------------------

function issueToError(issue: z.core.$ZodIssue, file: string, located: LocatedDocument | null): ConfigError {
  const base = issue.path.map((p) => String(typeof p === 'symbol' ? p.description : p));
  let segments: Array<string | number> = [...issue.path.filter((p): p is string | number => typeof p !== 'symbol')];
  let message = issue.message;
  let parentSegments = segments.slice(0, -1);
  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys[0] ?? '';
    parentSegments = segments;
    segments = [...segments, key];
    message = `unknown key "${key}"`;
  }
  const dotted = [...base, ...(issue.code === 'unrecognized_keys' ? [issue.keys[0] ?? ''] : [])].join('.');
  return {
    file,
    path: dotted,
    line: located ? lineOfPath(located, segments) : null,
    message,
    valid_keys: validKeysAt(HarnessConfigSchema, parentSegments),
  };
}

/** Validate one layer's raw value. Returns the typed config or a single ConfigError. */
export function validateLayer(raw: unknown, file: string, located: LocatedDocument | null): { config: HarnessConfig; deprecations?: string[] } | { error: ConfigError } {
  if (!isPlainObject(raw)) {
    return { error: { file, path: '', line: located ? lineOfPath(located, []) : null, message: 'config must be a mapping' } };
  }
  if ('schema' in raw && raw.schema !== 1) {
    return {
      error: {
        file,
        path: 'schema',
        line: located ? lineOfPath(located, ['schema']) : null,
        message: `unsupported config schema ${JSON.stringify(raw.schema)}; expected 1 (${MIGRATION_NOTE})`,
      },
    };
  }
  const upgraded = upgradeLegacyConfig(raw);
  const result = HarnessConfigSchema.safeParse(upgraded.raw);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    return { error: issueToError(issue, file, located) };
  }
  return upgraded.notes.length ? { config: result.data, deprecations: upgraded.notes.map((n) => `${file}: ${n}`) } : { config: result.data };
}

