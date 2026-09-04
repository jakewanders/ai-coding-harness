import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { piiAudit } from '../../src/analysis/pii.js';
import { NEW_EXPORT_DIFF, PII_DIFF } from './fixtures.js';

describe('piiAudit', () => {
  it('flags identity values flowing into sinks and classifies the sink', () => {
    const findings = piiAudit(parseDiff(PII_DIFF));
    expect(findings).toEqual([
      { file: 'src/auth.ts', line: 11, sink: 'log', text: 'console.log(user.email);' },
      { file: 'src/auth.ts', line: 12, sink: 'analytics', text: "analytics.track('login', { phone: user.phone });" },
    ]);
  });

  it('classifies storage and error-body sinks and ignores identity values without a sink', () => {
    const diff = `diff --git a/x.ts b/x.ts
--- a/x.ts
+++ b/x.ts
@@ -1,0 +1,5 @@
+localStorage.setItem('u', user.address);
+db.query('INSERT INTO audit (ssn) VALUES ($1)', [ssn]);
+res.status(400).json({ error: \`bad token \${token}\` });
+const name = user.name;
+throw new Error(\`no user for \${email}\`);
`;
    const findings = piiAudit(parseDiff(diff));
    expect(findings.map((f) => [f.line, f.sink])).toEqual([[1, 'storage'], [2, 'storage'], [3, 'error_body'], [5, 'error_body']]);
  });

  it('returns nothing for a clean diff', () => {
    expect(piiAudit(parseDiff(NEW_EXPORT_DIFF))).toEqual([]);
  });
});
