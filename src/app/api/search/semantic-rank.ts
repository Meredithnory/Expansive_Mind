import { createPrivateEmbedding } from "../openrouter";
import type { UsageContext } from "../../lib/usage-meter";

type SearchResult = {
    sourceId: string;
    doi?: string;
    title: string;
    abstract?: unknown;
    source?: "nih" | "nature" | "scholar";
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
    usageContext?: UsageContext,
): Promise<number[] | null> => {
    if (!process.env.AI_API_KEY || results.length < 2) {
        return null;
    }

    const eligibleResults = results.slice(0, 10);
    const inputs = [
        query.slice(0, 500),
        ...eligibleResults.map((result) => {
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

        const scores = response.data
            .slice(1)
            .map(({ embedding }) =>
                Math.max(0, cosineSimilarity(queryEmbedding, embedding)),
            );
        return [
            ...scores,
            ...Array(Math.max(0, results.length - scores.length)).fill(0),
        ];
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
    const semanticScores = await getSemanticScores(
        query,
        deduplicated,
        usageContext,
    );
    const maxLexicalScore = Math.max(...lexicalScores, 1);

    const ranked = deduplicated
        .map((result, index) => {
            const lexicalScore = lexicalScores[index] / maxLexicalScore;
            const sourceRankScore = 1 / (index + 1);
            const score = semanticScores
                ? lexicalScore * 0.55 +
                  semanticScores[index] * 0.35 +
                  sourceRankScore * 0.1
                : lexicalScore * 0.85 + sourceRankScore * 0.15;

            return { result, score, index };
        })
        .sort(
            (left, right) =>
                right.score - left.score || left.index - right.index,
        )
        .map(({ result }) => result);

    const bestNatureIndex = ranked.findIndex(
        (result) => result.source === "nature",
    );
    if (bestNatureIndex > 0) {
        const [bestNatureResult] = ranked.splice(bestNatureIndex, 1);
        ranked.unshift(bestNatureResult);
    }

    return ranked;
};
