/** Science verbs the paper assistant cycles through while an answer loads. */
export const THINKING_WORDS = [
    "Hypothesizing",
    "Titrating",
    "Pipetting",
    "Centrifuging",
    "Incubating",
    "Sequencing",
    "Catalyzing",
    "Distilling",
    "Crystallizing",
    "Calibrating",
    "Culturing",
    "Annealing",
    "Amplifying",
    "Transcribing",
    "Splicing",
    "Photosynthesizing",
    "Fermenting",
    "Precipitating",
    "Assaying",
    "Metabolizing",
    "Osmosing",
    "Nucleating",
    "Diffusing",
    "Entangling",
    "Replicating",
    "Peer-reviewing",
] as const;

export const THINKING_WORD_INTERVAL_MS = 2400;

/** Picks a random word other than `current`, so the label always visibly changes. */
export function nextThinkingWord(
    current: string | null,
    random: () => number = Math.random,
): string {
    const choices = THINKING_WORDS.filter((word) => word !== current);
    const index = Math.min(
        choices.length - 1,
        Math.floor(random() * choices.length),
    );
    return choices[index];
}
