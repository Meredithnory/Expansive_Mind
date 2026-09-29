import { createPrivateEmbedding } from "../openrouter";
import type { UsageContext } from "../../lib/usage-meter";

type SearchResult = {
    sourceId: string;
    doi?: string;
    title: string;
    abstract?: unknown;
    source?: "nih" | "nature" | "scholar" | "europepmc" | "crossref";
    access?: { canSendToAI?: boolean };
};

const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "does",
    "for",
    "from",
    "how",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
]);

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

const tokenize = (value: string) =>
    Array.from(
        new Set(
            normalizeText(value)
                .split(" ")
                .filter((token) => token.length > 1 && !STOP_WORDS.has(token)),
        ),
    );

const unknownToText = (value: unknown): string => {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(unknownToText).join(" ");
    if (typeof value === "object") {
        return Object.values(value).map(unknownToText).join(" ");
    }
    return "";
};

const tokenCoverage = (tokens: string[], text: string) => {
    if (tokens.length === 0) return 0;
    const normalized = normalizeText(text);
    const matches = tokens.filter((token) => normalized.includes(token)).length;
    return matches / tokens.length;
};

/** How many candidates get the embedding score: the best by word match, whatever their source. */
export const SEMANTIC_POOL_SIZE = 40;

const getLexicalScore = (query: string, result: SearchResult) => {
    const normalizedQuery = normalizeText(query);
    const queryTokens = tokenize(query);
    const title = result.title || "";
    const abstract = unknownToText(result.abstract);
    const normalizedTitle = normalizeText(title);
    const normalizedAbstract = normalizeText(abstract);
    const exactTitlePhrase =
        normalizedQuery.length > 1 && normalizedTitle.includes(normalizedQuery);
    const exactAbstractPhrase =
        normalizedQuery.length > 1 &&
        normalizedAbstract.includes(normalizedQuery);

    if (!normalizedAbstract) {
        // Some sources send no abstract with a hit (NIH search summaries).
        // Score the title alone rather than marking the paper down for it.
        return (
            tokenCoverage(queryTokens, title) * 0.85 +
            (exactTitlePhrase ? 0.15 : 0)
        );
    }

    return (
        tokenCoverage(queryTokens, title) * 0.58 +
        tokenCoverage(queryTokens, abstract) * 0.27 +
        (exactTitlePhrase ? 0.12 : 0) +
        (exactAbstractPhrase ? 0.03 : 0)
    );
};

const cosineSimilarity = (left: number[], right: number[]) => {
    let dotProduct = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;

    for (let index = 0; index < left.length; index += 1) {
        dotProduct += left[index] * right[index];
        leftMagnitude += left[index] ** 2;
        rightMagnitude += right[index] ** 2;
    }

    const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
    return denominator ? dotProduct / denominator : 0;
};

const getSemanticScores = async <T extends SearchResult>(
    query: string,
    results: T[],
    pool: number[],
    usageContext?: UsageContext,
): Promise<number[] | null> => {
    if (!process.env.AI_API_KEY || results.length < 2 || pool.length === 0) {
        return null;
    }

    const inputs = [
        query.slice(0, 500),
        ...pool.map((index) => {
            const result = results[index];
            const abstract = result.access?.canSendToAI
                ? unknownToText(result.abstract)
                      .replace(/\s+/g, " ")
                      .trim()
                      .slice(0, 600)
                : "";
            return `${result.title}\n${abstract}`;
        }),
    ];

    try {
        const response = await createPrivateEmbedding(
            {
                model:
                    process.env.SEARCH_EMBEDDING_MODEL ||
                    "openai/text-embedding-3-small",
                input: inputs,
            },
            usageContext,
        );
        const queryEmbedding = response.data[0]?.embedding;
        if (!queryEmbedding || response.data.length !== inputs.length) {
            return null;
        }

        const scores: number[] = Array(results.length).fill(0);
        response.data.slice(1).forEach(({ embedding }, position) => {
            scores[pool[position]] = Math.max(
                0,
                cosineSimilarity(queryEmbedding, embedding),
            );
        });
        return scores;
    } catch {
        console.warn("Semantic search unavailable; using lexical ranking");
        return null;
    }
};

const deduplicateResults = <T extends SearchResult>(results: T[]) => {
    const deduplicated: T[] = [];
    const indexByKey = new Map<string, number>();

    for (const result of results) {
        const normalizedDoi = result.doi?.toLowerCase().trim();
        const normalizedTitle = normalizeText(result.title);
        const key = normalizedDoi
            ? `doi:${normalizedDoi}`
            : normalizedTitle
              ? `title:${normalizedTitle}`
              : `source:${result.sourceId}`;
        const existingIndex = indexByKey.get(key);

        if (existingIndex === undefined) {
            indexByKey.set(key, deduplicated.length);
            deduplicated.push(result);
        } else if (result.source === "nature") {
            deduplicated[existingIndex] = result;
        }
    }

    return deduplicated;
};

export const rankSearchResults = async <T extends SearchResult>(
    query: string,
    results: T[],
    usageContext?: UsageContext,
): Promise<T[]> => {
    const deduplicated = deduplicateResults(results);
    const lexicalScores = deduplicated.map((result) =>
        getLexicalScore(query, result),
    );
    // Sources arrive one after another (all Springer, then all NIH), so the
    // embedding pool is the best by word match, not the first in the list.
    const pool = deduplicated
        .map((_, index) => index)
        .sort(
            (left, right) =>
                lexicalScores[right] - lexicalScores[left] || left - right,
        )
        .slice(0, SEMANTIC_POOL_SIZE);
    const semanticScores = await getSemanticScores(
        query,
        deduplicated,
        pool,
        usageContext,
    );
    const maxLexicalScore = Math.max(...lexicalScores, 1);
    // Each source's own order is a relevance signal; count it within the
    // source so whichever source is listed first isn't favored.
    const seenPerSource = new Map<string, number>();
    const rankInSource = deduplicated.map((result) => {
        const key = result.source ?? "other";
        const rank = seenPerSource.get(key) ?? 0;
        seenPerSource.set(key, rank + 1);
        return rank;
    });

    const ranked = deduplicated
        .map((result, index) => {
            const lexicalScore = lexicalScores[index] / maxLexicalScore;
            const sourceRankScore = 1 / (rankInSource[index] + 1);
            const score = semanticScores
                ? lexicalScore * 0.55 +
                  semanticScores[index] * 0.35 +
                  sourceRankScore * 0.1
                : lexicalScore * 0.85 + sourceRankScore * 0.15;

            return { result, score, index };
        })
        .sort(
            (left, right) =>
                right.score - left.score ||
                rankInSource[left.index] - rankInSource[right.index] ||
                left.index - right.index,
        )
        .map(({ result }) => result);

    return ranked;
};
