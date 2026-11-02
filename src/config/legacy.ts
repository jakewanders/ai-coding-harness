/**
 * Deprecated config spellings, upgraded in memory before validation so that
 * older files keep loading. Each upgrade yields a note that `system doctor`
 * prints; the file on disk is never rewritten.
 */

type Raw = Record<string, unknown>;

function isPlainObject(v: unknown): v is Raw {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Stage ids renamed in the stage-vocabulary change. */
export const LEGACY_STAGE_IDS: Record<string, string> = { scope: 'define', verify: 'walkthrough', publish: 'pr', close: 'wrap_up' };

function renameKeys(obj: Raw, map: Record<string, string>, where: string, notes: string[]): Raw {
  const out: Raw = {};
  for (const [key, value] of Object.entries(obj)) {
    const now = map[key];
    if (now && !(now in obj)) {
      out[now] = value;
      notes.push(`${where}: "${key}" is deprecated, use "${now}"`);
    } else if (now) {
      notes.push(`${where}: ignoring deprecated "${key}" because "${now}" is also set`);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Return the config with deprecated keys and stage ids rewritten, plus a note per rewrite. */
export function upgradeLegacyConfig(raw: Raw): { raw: Raw; notes: string[] } {
  const notes: string[] = [];
  const out: Raw = { ...raw };

  if (Array.isArray(out.tickets)) {
    out.tickets = out.tickets.map((rule, i) => {
      if (!isPlainObject(rule) || !isPlainObject(rule.status_hints)) return rule;
      return { ...rule, status_hints: renameKeys(rule.status_hints, LEGACY_STAGE_IDS, `tickets[${i}].status_hints`, notes) };
    });
  }

  if (Array.isArray(out.custom_gates)) {
    out.custom_gates = out.custom_gates.map((gate, i) => {
      if (!isPlainObject(gate) || typeof gate.stage !== 'string' || !(gate.stage in LEGACY_STAGE_IDS)) return gate;
      notes.push(`custom_gates[${i}].stage: "${gate.stage}" is deprecated, use "${LEGACY_STAGE_IDS[gate.stage]}"`);
      return { ...gate, stage: LEGACY_STAGE_IDS[gate.stage] };
    });
  }

  if (isPlainObject(out.modes)) {
    const modes: Raw = {};
    for (const [name, mode] of Object.entries(out.modes)) {
      modes[name] = isPlainObject(mode) ? renameKeys(mode, { verify_after_publish: 'walkthrough_after_pr' }, `modes.${name}`, notes) : mode;
    }
    out.modes = modes;
  }

  return { raw: out, notes };
}
