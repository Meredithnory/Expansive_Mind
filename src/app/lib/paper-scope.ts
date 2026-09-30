// When a cited paper studied a narrower group than the question asked
// about: livestock for a question about gene editing in general, mice for a
// question about patients. Only then does the brief say so; a paper that
// studied what the question names needs no note.

// A label, not a paragraph: the first words of the paper's population.
const SCOPE_MAX = 90;

// Organisms and model systems. A question that names none of these is about
// people or the field as a whole, so a paper limited to one is narrower.
const GROUPS: Array<{ id: string; pattern: RegExp; animal?: boolean }> = [
    {
        id: "livestock",
        animal: true,
        pattern:
            /\b(livestock|farm animals?|cattle|cows?|bovine|pigs?|piglets?|swine|porcine|sheep|lambs?|ovine|goats?|caprine|poultry|chickens?|broilers?)\b/i,
    },
    {
        id: "rodent",
        animal: true,
        pattern: /\b(mice|mouse|murine|rats?|rodents?|hamsters?)\b/i,
    },
    {
        id: "primate",
        animal: true,
        pattern: /\b(non-?human primates?|macaques?|monkeys?|marmosets?)\b/i,
    },
    { id: "pet", animal: true, pattern: /\b(dogs?|canine|cats?|feline)\b/i },
    { id: "fish", animal: true, pattern: /\b(zebrafish|medaka)\b/i },
    {
        id: "invertebrate",
        animal: true,
        pattern: /\b(drosophila|fruit flies|c\.?\s?elegans|nematodes?)\b/i,
    },
    { id: "yeast", pattern: /\byeast\b/i },
    { id: "plant", pattern: /\b(plants?|arabidopsis|crop species)\b/i },
    {
        id: "cells",
        pattern:
            /\b(cell lines?|in vitro|cultured cells|organoids?|ipscs?|induced pluripotent|hek293|hela)\b/i,
    },
    { id: "embryo", pattern: /\b(embryos?|zygotes?)\b/i },
];

const ANY_ANIMAL = /\b(animals?|animal models?|preclinical|veterinary)\b/i;

/** Short label for who or what a paper studied. Empty when unknown. */
export function scopeLabel(population: string | undefined): string {
    const text = (population ?? "").trim().replace(/\s+/g, " ");
    if (text.length <= SCOPE_MAX) return text;
    const slice = text.slice(0, SCOPE_MAX);
    const lastSpace = slice.lastIndexOf(" ");
    return `${slice.slice(0, lastSpace > SCOPE_MAX * 0.6 ? lastSpace : SCOPE_MAX)}…`;
}

/**
 * The paper's population, shortened, when it names an organism or model
 * system the question does not. Null when the paper studied what was asked,
 * or when its population is unknown.
 */
export function narrowerScope(
    question: string | undefined,
    population: string | undefined,
): string | null {
    const label = scopeLabel(population);
    if (!label) return null;
    const asked = question ?? "";
    const askedAnimals = ANY_ANIMAL.test(asked);
    const narrower = GROUPS.some(
        (group) =>
            group.pattern.test(label) &&
            !group.pattern.test(asked) &&
            !(group.animal && askedAnimals),
    );
    return narrower ? label : null;
}
