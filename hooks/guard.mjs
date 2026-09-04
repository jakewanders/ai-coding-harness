#!/usr/bin/env node
// Committed bootstrap for the safety hooks. No dependencies. It loads the
// built implementation (dist/hooks/index.js, or HARNESS_HOOK_IMPL) and, when
// that fails, fails loud: dangerous verbs are blocked with build instructions,
// everything else passes with a warning. Silent degradation is not an option.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const DANGEROUS = [/\bgit\b[^|;&]*\b(commit|push)\b/, /\b(pr|pull-request|pull_request|merge-request|mr)\s+create\b/, /\bpull-request\b/, /\bmerge-request\b/];
const BUILD_HINT = 'harness hooks are not built. Run `npm install && npm run build` in the plugin root (the build itself is allowed), then retry.';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    if (process.stdin.isTTY) resolve('');
  });
}

function parse(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function commandOf(payload) {
  const input = payload && payload.tool_input;
  return input && typeof input.command === 'string' ? input.command : '';
}

async function main() {
  const guard = process.argv[2] || 'pre-bash';
  const payload = parse(await readStdin());
  const implPath = process.env.HARNESS_HOOK_IMPL || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist', 'hooks', 'index.js');
  let impl;
  try {
    impl = await import(pathToFileURL(implPath).href);
  } catch (e) {
    const command = commandOf(payload);
    const dangerous = guard === 'pre-bash' && DANGEROUS.some((re) => re.test(command));
    const detail = e && e.message ? String(e.message).split('\n')[0] : String(e);
    if (dangerous) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `${BUILD_HINT} (${detail})` }) + '\n');
      process.stderr.write(`BLOCKED: ${BUILD_HINT}\n`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify({ systemMessage: `warning: harness hooks not built; safety guards inactive for this command (${detail}). Run npm install && npm run build.` }) + '\n');
    process.exit(0);
  }
  try {
    const result = await impl.runHook(guard, payload);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.exit);
  } catch (e) {
    const command = commandOf(payload);
    const dangerous = guard === 'pre-bash' && DANGEROUS.some((re) => re.test(command));
    const msg = e && e.stack ? e.stack : String(e);
    if (dangerous) {
      process.stdout.write(JSON.stringify({ decision: 'block', reason: `harness hook failed while checking a dangerous command: ${msg}` }) + '\n');
      process.exit(2);
    }
    process.stdout.write(JSON.stringify({ systemMessage: `warning: harness hook failed: ${msg}` }) + '\n');
    process.exit(0);
  }
}

main();
