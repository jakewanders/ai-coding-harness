const ASSERTIVE = /\b(fixes|fixed|ensures|always|never|no longer|handles|covers|guarantees|prevents|eliminates|resolves)\b/i;
const SCREENSHOT = /\b(renders?|displays?|shows?|button|page|screen|modal|layout|ui|visible)\b/i;
const RUN = /\b(passes|green|build|lint|typecheck|compiles|faster|slower|performance|benchmark|ci)\b/i;
const LINK = /\b(ticket|issue|pr|pull request|docs?|spec|rfc|reported)\b/i;
/** Split prose into sentences and bullet items. */
export function sentences(text) {
    const out = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/^\s*(?:[-*]|\d+\.)\s+/, '').trim();
        if (!line || /^#/.test(line))
            continue;
        for (const s of line.split(/(?<=[.!?])\s+/))
            if (s.trim())
                out.push(s.trim());
    }
    return out;
}
/** Sentences that assert an outcome, each with the kind of proof it needs. */
export function claimsAudit(text) {
    return sentences(text)
        .filter((s) => ASSERTIVE.test(s))
        .map((s) => ({ text: s, needs: SCREENSHOT.test(s) ? 'screenshot' : RUN.test(s) ? 'run' : LINK.test(s) ? 'link' : 'test' }));
}
