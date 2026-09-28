/**
 * Hints shown under the Discovery question while it is typed. They nudge
 * toward a specific question; they never block a run.
 */
export interface QuestionCheck {
    id: "specific" | "subject" | "outcome";
    label: string;
    ok: boolean;
}

// People, models, or a condition: "type 2 diabetes" names what it is about.
const SUBJECT_RE =
    /\b(patients?|adults?|children|mice|humans?|women|men|older|infants?|cells?|tumou?rs?|in vivo|people|rats?|organoids?|diseases?|cancers?|diabetes|syndromes?|disorders?|infections?|obesity|fibrosis|alzheimer|parkinson|sclerosis|arthritis|asthma|stroke|sepsis|leukemia|lymphoma|carcinoma|dementia|depression)/i;
const OUTCOME_RE =
    /\b(outcomes?|progression|survival|efficacy|risks?|mortality|response|persistence|events?|improv|reduc|slow|limit|influenc|barriers?)/i;

export function questionChecks(question: string): QuestionCheck[] {
    const trimmed = question.trim();
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    const specific = words >= 6;
    const subject = SUBJECT_RE.test(trimmed);
    const outcome = OUTCOME_RE.test(trimmed);
    return [
        {
            id: "specific",
            label: specific ? "Specific enough" : "Add a little more detail",
            ok: specific,
        },
        {
            id: "subject",
            label: subject ? "Names who or what" : "Who or what is it about?",
            ok: subject,
        },
        {
            id: "outcome",
            label: outcome ? "Has an outcome" : "What outcome matters?",
            ok: outcome,
        },
    ];
}
