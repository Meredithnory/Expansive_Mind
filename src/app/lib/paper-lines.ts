// Browser-safe: used by the paper reader and group links.

/** "12-15" or "12" -> { start, end }, for opening a paper at a line range. */
export function parseLineRange(
    value: string | null | undefined,
): { start: number; end: number } | null {
    const match = /^(\d{1,6})(?:-(\d{1,6}))?$/.exec(value?.trim() || "");
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end - start > 200) return null;
    return { start, end };
}

/** Reader link that opens a paper at a line range (no quoted text in the URL). */
export function paperLinesHref(path: string, start: number, end: number) {
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}lines=${start}-${end}`;
}
