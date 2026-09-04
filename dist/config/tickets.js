function compile(pattern) {
    try {
        return new RegExp(pattern);
    }
    catch {
        return null;
    }
}
/** First ticket rule whose pattern matches `id`; invalid patterns are skipped. */
export function matchTicket(id, config) {
    for (const rule of config.tickets ?? []) {
        const re = compile(rule.pattern);
        if (re && re.test(id))
            return rule;
    }
    return null;
}
/** The rule's url template with every `{id}` filled, or null. */
export function ticketUrl(id, config) {
    const rule = matchTicket(id, config);
    if (!rule?.url)
        return null;
    return rule.url.replaceAll('{id}', encodeURIComponent(id));
}
/** Tracker status the ticket should carry at a stage boundary, or null. */
export function statusHint(id, boundary, config) {
    const hint = matchTicket(id, config)?.status_hints?.[boundary];
    return hint ? hint : null;
}
