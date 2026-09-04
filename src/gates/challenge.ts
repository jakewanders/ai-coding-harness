import fs from 'node:fs';
import path from 'node:path';
import { defineGate, registerGate } from '../registry/gates.js';

export const reviewVerdictShip = registerGate(defineGate({
  id: 'review_verdict_ship',
  stage: 'review',
  description: "The current cycle's synthesized review verdict is ship.",
  severity: 'block',
  check: (ctx) => {
    let verdict: string | undefined = ctx.state.reviews?.[ctx.state.cycle];
    if (!verdict) {
      const file = path.join(ctx.unitDir, 'reviews', `cycle-${ctx.state.cycle}.json`);
      if (fs.existsSync(file)) {
        try { verdict = (JSON.parse(fs.readFileSync(file, 'utf8')) as { verdict?: string }).verdict; } catch { /* unreadable review file counts as missing */ }
      }
    }
    if (verdict === 'ship') return { pass: true };
    return { pass: false, remedy: verdict ? `review verdict for cycle ${ctx.state.cycle} is ${verdict}; revise and re-review, then evidence synthesize` : `no synthesized review for cycle ${ctx.state.cycle}; record the review columns and run evidence synthesize` };
  },
}));

export const challengePassed = registerGate(defineGate({
  id: 'challenge_passed',
  stage: 'publish',
  description: 'The once-per-unit challenge pass reported a ship verdict (sticky).',
  severity: 'block',
  check: (ctx) => (ctx.state.challenge_passed ? { pass: true } : { pass: false, remedy: 'run the challenge stage and report it with verdict ship (unit report { stage: challenge, verdict: ship })' }),
}));
