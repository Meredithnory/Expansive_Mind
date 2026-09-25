export type DiscoveryQueryStatus = "ok" | "corrected" | "unclear";

export type DiscoveryQueryAssessment = {
    status: DiscoveryQueryStatus;
    suggestion: string | null;
};

const KEYBOARD_RUNS = [
    "qwerty",
    "qwer",
    "asdfgh",
    "asdf",
    "zxcvbn",
    "zxcv",
    "abcdef",
    "abcde",
    "12345",
];

const tokenize = (value: string) =>
    value.toLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? [];

const isKeyboardSmashToken = (token: string) => {
    if (
        KEYBOARD_RUNS.some(
            (run) =>
                token === run ||
                (token.length <= 12 &&
                    run.length >= 4 &&
                    token.includes(run)),
        )
    ) {
        return true;
    }
    if (/(.)\1{3,}/.test(token)) return true;
    if (token.length >= 4 && !/[aeiouy0-9-]/i.test(token)) return true;
    if (/[bcdfghjklmnpqrstvwxz]{6,}/i.test(token)) return true;
    return false;
};

/** Obvious keyboard smash only — misspellings like "inflammry" stay for the model. */
export function looksLikeUnclearResearchQuestion(query: string): boolean {
    const trimmed = query.trim();
    if (!trimmed) return false;

    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return true;

    return tokens.every(
        (token) => token.length <= 1 || isKeyboardSmashToken(token),
    );
}

export function discoveryDisplayTitle(
    question: string,
    correctedQuery?: string | null,
) {
    const corrected = correctedQuery?.trim();
    return corrected || question;
}

export type SpellingGateDecision = "run" | "block" | "confirm" | "run-anyway";

export function spellingGateDecision(
    assessment: DiscoveryQueryAssessment | null,
): SpellingGateDecision {
    if (!assessment) return "run-anyway";
    if (assessment.status === "unclear") return "block";
    if (assessment.status === "corrected" && assessment.suggestion) {
        return "confirm";
    }
    return "run";
}
