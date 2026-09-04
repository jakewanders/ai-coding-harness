import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE_KINDS } from '../evidence/kinds.js';
import { defineGate, registerGate } from '../registry/gates.js';
import { parseRequirement } from '../spec/requirement.js';
import { recordsThisCycle } from './_shared.js';

interface ValidationResult { criterion: string; status: string; proof: string }

export const criteriaValidated = registerGate(defineGate({
  id: 'criteria_validated',
  stage: 'publish',
  description: 'The latest criteria_validation record covers every acceptance criterion with a status other than unproven.',
  severity: 'block',
  check: (ctx) => {
    const reqFile = path.join(ctx.unitDir, 'requirement.md');
    const criteria = fs.existsSync(reqFile) ? parseRequirement(fs.readFileSync(reqFile, 'utf8')).criteria : [];
    const latest = ctx.state.evidence.filter((e) => e.kind === 'criteria_validation').at(-1);
    if (!latest) return { pass: false, remedy: EVIDENCE_KINDS.criteria_validation.remedy };
    const results = ((latest.payload as { results?: ValidationResult[] })?.results ?? []);
    const byId = new Map(results.map((r) => [r.criterion, r]));
    const missing = criteria.filter((c) => !byId.has(c.id)).map((c) => c.id);
    const unproven = criteria.filter((c) => byId.get(c.id)?.status === 'unproven').map((c) => c.id);
    if (!criteria.length && !results.length) return { pass: false, remedy: 'no acceptance criteria recorded; set them with spec criteria and validate each one' };
    if (!missing.length && !unproven.length) return { pass: true };
    const parts = [];
    if (missing.length) parts.push(`not validated: ${missing.join(', ')}`);
    if (unproven.length) parts.push(`unproven: ${unproven.join(', ')}`);
    return { pass: false, remedy: `${parts.join('; ')}; record criteria_validation with a proof for each` };
  },
}));

export const claimsAudited = registerGate(defineGate({
  id: 'claims_audited',
  stage: 'publish',
  description: 'A claims record exists for this cycle.',
  severity: 'block',
  check: (ctx) => (recordsThisCycle(ctx, 'claims').length ? { pass: true } : { pass: false, remedy: `${EVIDENCE_KINDS.claims.remedy}; analyze claims extracts them from the PR body` }),
}));
