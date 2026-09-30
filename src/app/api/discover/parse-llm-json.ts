export function stripCodeFences(text: string): string {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return fenced[1].trim();
    return trimmed;
}

/**
 * Drops closing brackets that don't match the open one, outside strings.
 * gpt-4.1-mini sometimes ends a string field with a stray "]", as in
 * `"methodsQuote":"...cells."],"limitations":[...]`; one such character made
 * the whole Discover extraction unreadable (seen 2026-09-30 on 3–5 of 7 papers
 * in a run). A mismatched closer is never valid JSON, so removing it only
 * restores what the model meant.
 */
export function removeStrayClosers(text: string): string {
    const stack: Array<"{" | "["> = [];
    let inString = false;
    let escape = false;
    let out = "";
    for (const character of text) {
        if (inString) {
            out += character;
            if (escape) escape = false;
            else if (character === "\\") escape = true;
            else if (character === '"') inString = false;
            continue;
        }
        if (character === '"') inString = true;
        else if (character === "{" || character === "[") stack.push(character);
        else if (character === "}" || character === "]") {
            const opener = character === "}" ? "{" : "[";
            if (stack[stack.length - 1] !== opener) continue;
            stack.pop();
        }
        out += character;
    }
    return out;
}

export function parseJsonFromLlm(text: string): unknown | null {
    if (!text || typeof text !== "string") return null;
    const stripped = stripCodeFences(text);

    const parsed =
        parseJsonSlice(stripped) ??
        parseJsonSlice(removeStrayClosers(stripped)) ??
        repairTruncatedJson(removeStrayClosers(stripped));
    if (typeof parsed === "string" && parsed.trim().startsWith("{")) {
        return parseJsonSlice(parsed) ?? repairTruncatedJson(parsed) ?? parsed;
    }
    return parsed;
}

function parseJsonSlice(text: string): unknown | null {
    try {
        return JSON.parse(text);
    } catch {
        const objectStart = text.indexOf("{");
        const arrayStart = text.indexOf("[");
        const starts = [objectStart, arrayStart].filter((index) => index >= 0);
        if (starts.length === 0) return null;

        const start = Math.min(...starts);
        const closer = text[start] === "[" ? "]" : "}";
        const end = text.lastIndexOf(closer);
        if (end <= start) return null;

        try {
            return JSON.parse(text.slice(start, end + 1));
        } catch {
            return null;
        }
    }
}

export function repairTruncatedJson(text: string): unknown | null {
    const objectStart = text.indexOf("{");
    if (objectStart < 0) return null;
    const source = text.slice(objectStart);

    let inString = false;
    let escape = false;
    const stack: Array<"{" | "["> = [];
    let lastComplete = -1;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (character === "\\") {
                escape = true;
                continue;
            }
            if (character === '"') {
                inString = false;
                lastComplete = index;
            }
            continue;
        }
        if (character === '"') {
            inString = true;
            continue;
        }
        if (character === "{") stack.push("{");
        else if (character === "[") stack.push("[");
        else if (character === "}" || character === "]") {
            stack.pop();
            lastComplete = index;
        }
    }

    if (lastComplete < 0) return null;
    let repaired = source.slice(0, lastComplete + 1).replace(/,\s*$/, "");

    const closers: string[] = [];
    inString = false;
    escape = false;
    const remaining: Array<"{" | "["> = [];
    for (const character of repaired) {
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (character === "\\") {
                escape = true;
                continue;
            }
            if (character === '"') inString = false;
            continue;
        }
        if (character === '"') {
            inString = true;
            continue;
        }
        if (character === "{") remaining.push("{");
        else if (character === "[") remaining.push("[");
        else if (character === "}" || character === "]") remaining.pop();
    }
    while (remaining.length > 0) {
        closers.push(remaining.pop() === "{" ? "}" : "]");
    }

    repaired += closers.join("");
    try {
        return JSON.parse(repaired);
    } catch {
        return null;
    }
}
