export type HookEvent = 'pre-bash' | 'stop';

export interface HookPayload {
  event: HookEvent;
  command?: string;
  cwd: string;
}

/** Normalize the host's hook stdin JSON; unknown shapes become a pre-bash payload with no command. */
export function parseHostPayload(json: string, guardHint?: string): HookPayload {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json || '{}');
    if (typeof parsed === 'object' && parsed !== null) raw = parsed as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const cwd = typeof raw.cwd === 'string' && raw.cwd ? raw.cwd : process.cwd();
  const eventName = String(raw.hook_event_name ?? '');
  const isStop = eventName === 'Stop' || guardHint === 'stop_status' || guardHint === 'stop';
  if (isStop) return { event: 'stop', cwd };
  const input = raw.tool_input as Record<string, unknown> | undefined;
  const command = input && typeof input.command === 'string' ? input.command : undefined;
  return command === undefined ? { event: 'pre-bash', cwd } : { event: 'pre-bash', command, cwd };
}

export interface Decision {
  exit: number;
  stdout: string;
  stderr: string;
}

/** Block: deny decision on stdout, reason on stderr, exit 2. Pass: optional system message, exit 0. */
export function renderDecision(block: boolean, message: string): Decision {
  if (block) {
    return { exit: 2, stdout: JSON.stringify({ decision: 'block', reason: message }) + '\n', stderr: `BLOCKED by harness: ${message}\n` };
  }
  if (!message) return { exit: 0, stdout: '', stderr: '' };
  return { exit: 0, stdout: JSON.stringify({ systemMessage: message }) + '\n', stderr: '' };
}
