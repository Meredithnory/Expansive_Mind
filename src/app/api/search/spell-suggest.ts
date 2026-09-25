import convert from "xml-js";
import { createPrivateChatCompletion } from "../openrouter";
import { consumeRateLimit } from "../../lib/rate-limit";

const NIH_ESPELL_URL =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/espell.fcgi";
const NIH_API_KEY = process.env.API_KEY;
const NCBI_EMAIL = process.env.NCBI_EMAIL;
const NCBI_TOOL = process.env.NCBI_TOOL || "ExpansiveMind";

const normalizeQuery = (query: string) =>
    query.trim().toLowerCase().replace(/\s+/g, " ");

export const queriesMatch = (left: string, right: string) =>
    normalizeQuery(left) === normalizeQuery(right);

const getNihSpellSuggestion = async (query: string): Promise<string | null> => {
    const params = new URLSearchParams();
    params.append("db", "pmc");
    params.append("term", query);
    if (!NCBI_EMAIL) return null;
    params.append("tool", NCBI_TOOL);
    params.append("email", NCBI_EMAIL);
    if (NIH_API_KEY) {
        params.append("api_key", NIH_API_KEY);
    }

    const rateLimit = await consumeRateLimit({
        scope: "outbound-ncbi",
        identity: "global",
        limit: NIH_API_KEY ? 9 : 2,
        windowMs: 1_000,
    });
    if (!rateLimit.allowed) return null;
    const res = await fetch(`${NIH_ESPELL_URL}?${params.toString()}`);
    if (!res.ok) {
        return null;
    }

    const data = await res.text();
    const dataAsJSON = JSON.parse(convert.xml2json(data, { compact: true }));
    const corrected = dataAsJSON?.eSpellResult?.CorrectedQuery;
    const suggestion =
        typeof corrected === "string" ? corrected : corrected?._text;

    if (
        typeof suggestion !== "string" ||
        !suggestion.trim() ||
        queriesMatch(suggestion, query)
    ) {
        return null;
    }

    return suggestion.trim();
};

const getAiSpellSuggestion = async (query: string): Promise<string | null> => {
    if (!process.env.AI_API_KEY) {
        return null;
    }

    const completion = await createPrivateChatCompletion({
        model: "openai/gpt-4.1-mini",
        temperature: 0,
        messages: [
            {
                role: "system",
                content: `You fix misspelled biomedical and academic research search queries.
If the query is already correct, respond with exactly: OK
If it is misspelled, respond with ONLY the corrected search phrase — no quotes, punctuation, or explanation.
Preserve the user's intent, word order, and question form. Fix typos, transposed letters, missing spaces, and missing apostrophes.
Do not add topics, do not answer the question, and do not expand a correct abbreviation.
Keep valid gene names, drug names, and jargon (CRISPR, CAR-T, GLP-1, p53) as written when they are already correct.
Examples:
- "stemm cells" -> stem cells
- "machne lerning" -> machine learning
- "type 2 diabtes" -> type 2 diabetes
- "parkinsons desease" -> Parkinson's disease
- "glp1 recptor agonism" -> GLP-1 receptor agonism
- "car-t persistance solid tumers" -> CAR-T persistence solid tumors
- "alzheimers senolytics" -> Alzheimer's senolytics
- "crispr cas9" -> OK`,
            },
            {
                role: "user",
                content: query,
            },
        ],
    });

    const suggestion = completion.choices[0].message.content?.trim();
    if (
        !suggestion ||
        suggestion.toUpperCase() === "OK" ||
        queriesMatch(suggestion, query)
    ) {
        return null;
    }

    const cleaned = suggestion.replace(/^["']|["']$/g, "").trim();
    if (!cleaned || cleaned.length > Math.max(query.length * 2, query.length + 40)) {
        return null;
    }
    if (/^(the corrected|correction|did you mean)\b/i.test(cleaned)) {
        return null;
    }

    return cleaned;
};

export async function getAutocompleteSuggestion(
    query: string,
): Promise<string | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
        return null;
    }

    const nih = await getNihSpellSuggestion(trimmed).catch(() => null);
    if (nih) return nih;
    return getAiSpellSuggestion(trimmed).catch(() => null);
}

export async function suggestSearchQuery(
    query: string,
    options?: { allowAi?: boolean },
): Promise<string | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
        return null;
    }

    let nihSuggestion: string | null = null;
    try {
        if (options?.allowAi === false) {
            nihSuggestion = await getNihSpellSuggestion(trimmed);
        } else {
            const [nih, ai] = await Promise.all([
                getNihSpellSuggestion(trimmed).catch(() => null),
                getAiSpellSuggestion(trimmed).catch(() => null),
            ]);
            nihSuggestion = nih || ai;
        }
    } catch {
        console.error("Search suggestion failed");
    }

    return nihSuggestion;
}

export async function suggestSearchQueryNihOnly(
    query: string,
): Promise<string | null> {
    return suggestSearchQuery(query, { allowAi: false });
}

export async function suggestSearchQueryWithAi(
    query: string,
): Promise<string | null> {
    return getAiSpellSuggestion(query);
}

/** Prefer the model fix for full questions; fall back to NIH eSpell. */
export async function suggestDiscoveryQuery(
    query: string,
): Promise<string | null> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return null;

    const [nih, ai] = await Promise.all([
        getNihSpellSuggestion(trimmed).catch(() => null),
        getAiSpellSuggestion(trimmed).catch(() => null),
    ]);
    return ai || nih;
}
