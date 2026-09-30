// Pure helpers behind /admin (Product pulse): ranges, the question-to-brief
// funnel, and grouping questions into topics by the words people use.

export const PULSE_RANGES = [7, 30, 90] as const;
export type PulseRange = (typeof PULSE_RANGES)[number];

export function parsePulseRange(value: string | null | undefined): PulseRange {
    const days = Number(value);
    return (PULSE_RANGES as readonly number[]).includes(days)
        ? (days as PulseRange)
        : 30;
}

export type FunnelStep = {
    id: string;
    label: string;
    detail: string;
    count: number;
    /** Share of the step before, 0–100. Null for the first step or an empty one before it. */
    rate: number | null;
};

export function funnelSteps(
    steps: Array<Omit<FunnelStep, "rate">>,
): FunnelStep[] {
    return steps.map((step, index) => {
        const before = steps[index - 1]?.count ?? 0;
        return {
            ...step,
            rate: index === 0 || before === 0 ? null : Math.round((step.count / before) * 100),
        };
    });
}

// Words that say nothing about a topic in a research question.
const STOP = new Set(
    (
        "about after also among and any are associated association based been before being between both but can cause caused causes compared could current currently data does done during each effect effects efficacy evidence for from have how impact into its known latest many more most new not outcome outcomes over patients people really recent research risk role safety should show since some studies study such than that the their them there these they this those through treat treated treating treatment treatments use used using what when where whether which while who why will with without work would years"
    ).split(" "),
);

function questionTerms(question: string) {
    const words = (question.toLowerCase().match(/[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]/g) ?? [])
        .filter((word) => (word.length >= 3 || /\d/.test(word)) && !STOP.has(word));
    const terms = new Set<string>(words);
    for (let i = 0; i + 1 < words.length; i += 1) {
        terms.add(`${words[i]} ${words[i + 1]}`);
    }
    return terms;
}

export type QuestionTopic = {
    topic: string;
    runs: number;
    shared: number;
    /** Runs in the period before, for "vs before". */
    prior: number;
};

/**
 * The words and two-word phrases most questions share, most common first.
 * A phrase wins over its words when it covers most of their questions.
 */
export function questionTopics(
    current: Array<{ question: string; shared: boolean }>,
    prior: string[],
    limit = 6,
): QuestionTopic[] {
    const currentTerms = current.map((item) => questionTerms(item.question));
    const priorTerms = prior.map(questionTerms);
    const df = new Map<string, number>();
    for (const terms of currentTerms) {
        for (const term of terms) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const minimum = current.length >= 6 ? 2 : 1;
    const candidates = [...df.entries()]
        .filter(([term, count]) => count >= minimum && (term.includes(" ") || term.length >= 4 || /\d/.test(term)))
        .sort(
            (a, b) =>
                b[1] - a[1] ||
                Number(b[0].includes(" ")) - Number(a[0].includes(" ")) ||
                a[0].localeCompare(b[0]),
        );
    const picked: string[] = [];
    for (const [term, count] of candidates) {
        if (picked.length >= limit) break;
        const words = term.split(" ");
        const overlaps = picked.some((chosen) => {
            const chosenWords = chosen.split(" ");
            return words.some((word) => chosenWords.includes(word));
        });
        if (overlaps) continue;
        // Prefer a phrase that covers most of its first word's questions.
        if (words.length === 1) {
            const phrase = candidates.find(
                ([other, otherCount]) =>
                    other.includes(" ") &&
                    other.split(" ").includes(term) &&
                    otherCount >= Math.max(minimum, Math.ceil(count * 0.6)) &&
                    !picked.includes(other),
            );
            if (phrase) {
                picked.push(phrase[0]);
                continue;
            }
        }
        picked.push(term);
    }
    return picked.map((topic) => ({
        topic,
        runs: currentTerms.filter((terms) => terms.has(topic)).length,
        shared: current.filter((item, index) => item.shared && currentTerms[index].has(topic)).length,
        prior: priorTerms.filter((terms) => terms.has(topic)).length,
    }));
}
