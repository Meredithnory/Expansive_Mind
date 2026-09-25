export type ChatSource = { id: string; title: string; url: string; text: string };
const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
export function validateAnswer(raw: unknown, sources: ChatSource[]) {
    const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const claims = (Array.isArray(data.claims) ? data.claims : []).slice(0, 8).flatMap(item => {
        if (!item || typeof item !== "object") return [];
        const source = sources.find(s => s.id === item.sourceId);
        if (!source || typeof item.quote !== "string" || item.quote.length < 20 || item.quote.length > 900 || !normalize(source.text).includes(normalize(item.quote)) || typeof item.text !== "string") return [];
        return [{ text: item.text.slice(0, 2000), quote: item.quote, sourceId: source.id, title: source.title, url: source.url }];
    });
    const short = (value: unknown) => typeof value === "string" ? value.slice(0, 2000) : "";
    return { claims, interpretation: claims.length ? "These excerpts support reviewing the claims above; they do not establish business viability. Check whether each quotation supports the full conclusion and applies to your intended customer and setting." : "The answer did not contain usable source-matched claims. Narrow the question or select a paper to consult; no factual conclusion is shown.", followUp: short(data.followUp), suggestedSearch: short(data.suggestedSearch) };
}
