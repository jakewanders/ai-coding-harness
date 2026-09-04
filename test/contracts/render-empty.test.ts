import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { HeaderSchema } from '../../src/contracts/header.js';
import { STAGES } from '../../src/registry/stages.js';
import { dispatch } from '../../src/registry/tools.js';
import { unitTool } from '../../src/tools/unit.js';
import { makeCtx } from '../helpers/ctx.js';
import { makeTmpDir } from '../helpers/tmp.js';

describe('every stage renders on empty config', () => {
  it('produces a header that parses against HeaderSchema for all 20 entries', async () => {
    const ctx = makeCtx({ cwd: makeTmpDir('harness-nogit') });
    const started = await dispatch(unitTool, { action: 'start', source: 'text', text: 'empty-config unit' }, ctx);
    expect(started.envelope.ok).toBe(true);
    const { id } = started.envelope.data as { id: string };
    for (const s of STAGES) {
      const input: Record<string, unknown> = { action: 'brief', stage: s.name };
      if (!(s.standalone && s.takesNoId)) input.id = id;
      const r = await dispatch(unitTool, input, ctx);
      expect(r.envelope.ok, `${s.name}: ${r.envelope.summary}`).toBe(true);
      const m = /^```yaml\n([\s\S]*?)\n```/.exec(r.text);
      expect(m, `${s.name} header`).not.toBeNull();
      const header = HeaderSchema.parse(parseYaml(m![1]!));
      expect(header.stage).toBe(s.name);
      expect(header.config_errors).toEqual([]);
      if (s.standalone && s.takesNoId) expect(header.unit).toBe('(none)');
      else expect(header.unit).toBe(id);
    }
  });
});
