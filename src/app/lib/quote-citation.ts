import type { ArticleAttribution } from "./content-access-policy";

// "Copy with citation" for a highlighted passage: the quote plus enough
// attribution to find the source again. Open licenses like CC BY require the
// attribution, so the license name goes along when we know it.

const MAX_AUTHORS = 3;

function authorLine(authors: string[]): string {
    const names = authors.map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) return "";
    if (names.length <= MAX_AUTHORS) return names.join("; ");
    return `${names[0]} et al.`;
}

function year(date?: string): string {
    return date?.match(/\b(19|20)\d{2}\b/)?.[0] ?? "";
}

function sourceLink(attribution: ArticleAttribution): string {
    const doi = attribution.doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
    if (doi) return `https://doi.org/${doi}`;
    return attribution.canonicalUrl?.trim() || "";
}

export function formatQuoteWithCitation(input: {
    excerpt: string;
    attribution: ArticleAttribution;
    sectionTitle?: string;
    licenseName?: string | null;
}): string {
    const quote = input.excerpt.replace(/\s+/g, " ").trim();
    const { attribution } = input;
    const authors = authorLine(attribution.authors);
    const when = year(attribution.publicationDate);
    const venue = attribution.publicationName || attribution.sourceLabel;
    const byline = [
        [authors, when && `(${when})`].filter(Boolean).join(" "),
        attribution.title?.trim(),
        venue?.trim(),
    ]
        .filter(Boolean)
        .map((part) => part!.replace(/\.$/, ""))
        .join(". ");
    const where = input.sectionTitle ? ` (${input.sectionTitle})` : "";
    const tail = [sourceLink(attribution), input.licenseName?.trim()]
        .filter(Boolean)
        .join(" · ");
    return [`“${quote}”${where}`, `— ${byline}.`, tail].filter(Boolean).join("\n");
}
