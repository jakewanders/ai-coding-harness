import { spawn } from 'node:child_process';

export interface RunOptions {
  cwd: string;
  timeoutMs: number;
  env?: Record<string, string>;
}

export interface RunOutput {
  exit: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Run a shell command, capturing output; kills it after `timeoutMs`. Never throws. */
export function runCommand(cmd: string, opts: RunOptions): Promise<RunOutput> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(cmd, { shell: true, cwd: opts.cwd, env: { ...process.env, ...(opts.env ?? {}) }, stdio: ['ignore', 'pipe', 'pipe'] });
    const finish = (exit: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ exit, stdout, stderr, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, opts.timeoutMs);
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('error', (e) => {
      stderr += `${stderr ? '\n' : ''}${e.message}`;
      finish(-1);
    });
    child.on('close', (code, signal) => finish(code ?? (signal ? -1 : 1)));
  });
}

/** Last `n` non-empty-trailing lines of a text. */
export function tailLines(text: string, n: number): string {
  const lines = text.replace(/\n+$/, '').split('\n');
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}
