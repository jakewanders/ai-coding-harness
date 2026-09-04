/** Parse a unified diff into per-file added/removed lines with line numbers. */
export function parseDiff(unified) {
    const files = [];
    let current = null;
    let oldLine = 0;
    let newLine = 0;
    let oldPath = null;
    for (const raw of unified.split('\n')) {
        if (raw.startsWith('diff --git ')) {
            const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
            current = { path: m?.[2] ?? m?.[1] ?? raw.slice('diff --git '.length), added: [], removed: [], isNew: false };
            files.push(current);
            oldPath = null;
            continue;
        }
        if (!current)
            continue;
        if (raw.startsWith('new file mode')) {
            current.isNew = true;
            continue;
        }
        if (raw.startsWith('--- ')) {
            oldPath = raw.slice(4).trim();
            if (oldPath === '/dev/null')
                current.isNew = true;
            continue;
        }
        if (raw.startsWith('+++ ')) {
            const p = raw.slice(4).trim();
            if (p !== '/dev/null')
                current.path = p.replace(/^b\//, '');
            else if (oldPath && oldPath !== '/dev/null')
                current.path = oldPath.replace(/^a\//, '');
            continue;
        }
        const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (hunk) {
            oldLine = Number(hunk[1]);
            newLine = Number(hunk[2]);
            continue;
        }
        if (raw.startsWith('+')) {
            current.added.push({ line: newLine, text: raw.slice(1) });
            newLine++;
            continue;
        }
        if (raw.startsWith('-')) {
            current.removed.push({ line: oldLine, text: raw.slice(1) });
            oldLine++;
            continue;
        }
        if (raw.startsWith(' ')) {
            oldLine++;
            newLine++;
            continue;
        }
        if (raw.startsWith('\\'))
            continue; // "\ No newline at end of file"
    }
    return files;
}
/** Added text of every file joined, for keyword analyses. */
export function addedText(files) {
    return files.flatMap((f) => f.added.map((l) => l.text)).join('\n');
}
