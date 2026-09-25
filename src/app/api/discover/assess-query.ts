import { createPrivateChatCompletion } from "../openrouter";
import { parseJsonFromLlm } from "./parse-llm-json";
import { applyDiscoveryQuestionCorrection } from "./discovery-query";
import {
    queriesMatch,
    suggestSearchQueryNihOnly,
} from "../search/spell-suggest";
import {
    looksLikeUnclearResearchQuestion,
    type DiscoveryQueryAssessment,
} from "../../lib/query-quality";

const ASSESS_MODEL = "openai/gpt-4.1-mini";

const UNCLEAR_MESSAGE =
    "This doesn't look like a research question. Check the spelling or try a clearer biomedical topic.";

export const UNCLEAR_QUESTION_ERROR = UNCLEAR_MESSAGE;

const emptyAssessment = (): DiscoveryQueryAssessment => ({
    status: "ok",
    suggestion: null,
});

const unclearAssessment = (): DiscoveryQueryAssessment => ({
    status: "unclear",
    suggestion: null,
});

function parseAssessmentContent(
    content: string | null | undefined,
    query: string,
): DiscoveryQueryAssessment | null {
    if (!content?.trim()) return null;
    const trimmed = content.trim();
    if (/^unclear$/i.test(trimmed)) return unclearAssessment();
    if (/^ok$/i.test(trimmed)) return emptyAssessment();

    const parsed = parseJsonFromLlm(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>;
        const status = String(record.status || "").toLowerCase();
        const suggestion =
            typeof record.suggestion === "string"
                ? record.suggestion.trim()
                : "";

        if (status === "unclear") return unclearAssessment();
        if (status === "ok") return emptyAssessment();
        if (
            status === "corrected" &&
            suggestion &&
            !queriesMatch(suggestion, query)
        ) {
            return {
                status: "corrected",
                suggestion: applyDiscoveryQuestionCorrection(query, suggestion),
            };
        }
        return emptyAssessment();
    }

    const cleaned = trimmed.replace(/^["']|["']$/g, "").trim();
    if (
        cleaned &&
        cleaned.length <= Math.max(query.length * 2, query.length + 40) &&
        !/^(the corrected|correction|did you mean)\b/i.test(cleaned) &&
        !queriesMatch(cleaned, query)
    ) {
        return {
            status: "corrected",
            suggestion: applyDiscoveryQuestionCorrection(query, cleaned),
        };
    }

    return emptyAssessment();
}

async function assessWithModel(
    query: string,
): Promise<DiscoveryQueryAssessment | null> {
    if (!process.env.AI_API_KEY) return null;

    const completion = await createPrivateChatCompletion({
        model: ASSESS_MODEL,
        temperature: 0,
        max_tokens: 120,
        messages: [
            {
                role: "system",
                content: `You assess a biomedical research question for spelling and whether it is intelligible.
Return JSON only, no markdown:
{"status":"ok"}
{"status":"corrected","suggestion":"..."}
{"status":"unclear"}

Rules:
- ok: already a readable research question or valid scientific phrase, including jargon, gene names, and abbreviations.
- corrected: there are clear typos. suggestion is the same question with spelling fixed only. Preserve intent, word order, and question form.
- unclear: keyboard smash, random letters, or not recognizable as a research question or scientific phrase.
Do not answer the question. Do not add topics. Keep CRISPR, CAR-T, GLP-1, p53 and similar terms when they are already correct.
Examples:
- "How to cure post inflammry hyperpigmentation on skin?" -> {"status":"corrected","suggestion":"How to cure post inflammatory hyperpigmentation on skin?"}
- "stemm cells" -> {"status":"corrected","suggestion":"stem cells"}
- "efrerg" -> {"status":"unclear"}
- "asdfgh" -> {"status":"unclear"}
- "CRISPR Cas9" -> {"status":"ok"}
- "What limits CAR-T persistence in solid tumors?" -> {"status":"ok"}`,
            },
            {
                role: "user",
                content: query,
            },
        ],
    });

    return parseAssessmentContent(
        completion.choices[0]?.message?.content,
        query,
    );
}

export async function assessDiscoveryQuestion(
    question: string,
): Promise<DiscoveryQueryAssessment> {
    const trimmed = question.trim();
    if (trimmed.length < 2) return emptyAssessment();
    if (looksLikeUnclearResearchQuestion(trimmed)) {
        return unclearAssessment();
    }

    const [modelResult, nihSuggestion] = await Promise.all([
        assessWithModel(trimmed).catch(() => null),
        suggestSearchQueryNihOnly(trimmed).catch(() => null),
    ]);

    if (modelResult?.status === "unclear") return modelResult;
    if (modelResult?.status === "corrected" && modelResult.suggestion) {
        const suggestion = applyDiscoveryQuestionCorrection(
            trimmed,
            modelResult.suggestion,
        );
        if (!queriesMatch(suggestion, trimmed)) {
            return { status: "corrected", suggestion };
        }
    }

    if (nihSuggestion && !queriesMatch(nihSuggestion, trimmed)) {
        const suggestion = applyDiscoveryQuestionCorrection(
            trimmed,
            nihSuggestion,
        );
        if (!queriesMatch(suggestion, trimmed)) {
            return { status: "corrected", suggestion };
        }
    }

    return emptyAssessment();
}

export { parseAssessmentContent };
