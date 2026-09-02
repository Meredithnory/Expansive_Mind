import type { EvidenceType, PaperExtraction } from "../api/discover/report-types";

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
    review: "Review",
    rct: "RCT",
    observational: "Observational",
    "in-vitro": "In vitro",
    animal: "Animal",
    computational: "Computational",
    other: "Other",
};

const EVIDENCE_TYPE_ORDER: EvidenceType[] = [
    "review",
    "rct",
    "observational",
    "in-vitro",
    "animal",
    "computational",
    "other",
];

export function isEvidenceType(value: unknown): value is EvidenceType {
    return typeof value === "string" && value in EVIDENCE_TYPE_LABELS;
}

export function evidenceTypeLabel(
    value: EvidenceType | string | undefined,
): string {
    return isEvidenceType(value)
        ? EVIDENCE_TYPE_LABELS[value]
        : EVIDENCE_TYPE_LABELS.other;
}

export function publicationYear(value?: string | null): string | null {
    if (!value) return null;
    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : null;
}

export function yearRangeLabel(dates: Array<string | undefined | null>): string {
    const years = dates
        .map((date) => publicationYear(date))
        .filter((year): year is string => Boolean(year))
        .sort();
    if (years.length === 0) return "";
    const first = years[0];
    const last = years[years.length - 1];
    return first === last ? first : `${first}–${last}`;
}

function asTrimmedString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

function asIndex(value: unknown): number | null {
    const index =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number.parseInt(value, 10)
              : NaN;
    return Number.isInteger(index) && index >= 1 ? index : null;
}

export function parseStoredPaperExtraction(
    value: unknown,
): PaperExtraction | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Record<string, unknown>;
    const index = asIndex(raw.index);
    const title = asTrimmedString(raw.title);
    if (!index || !title) return null;

    const supportingExcerpt = asTrimmedString(raw.supportingExcerpt);
    return {
        index,
        title,
        sourceLabel: asTrimmedString(raw.sourceLabel) || "Unknown source",
        authors: asStringList(raw.authors),
        publicationDate: asTrimmedString(raw.publicationDate) || undefined,
        keyFindings: asStringList(raw.keyFindings),
        methods: asTrimmedString(raw.methods),
        limitations: asStringList(raw.limitations),
        openQuestions: asStringList(raw.openQuestions),
        evidenceType: isEvidenceType(raw.evidenceType)
            ? raw.evidenceType
            : "other",
        ...(supportingExcerpt ? { supportingExcerpt } : {}),
    };
}

export function parseStoredPaperExtractions(
    value: unknown,
): PaperExtraction[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const extractions = value
        .map(parseStoredPaperExtraction)
        .filter((item): item is PaperExtraction => Boolean(item));
    return extractions.length > 0 ? extractions : undefined;
}

export function extractionForPaper(
    extractions: PaperExtraction[] | undefined,
    index: number,
): PaperExtraction | undefined {
    return extractions?.find((item) => item.index === index);
}

function pluralizeEvidence(type: EvidenceType, count: number): string {
    if (type === "rct") return count === 1 ? "1 RCT" : `${count} RCTs`;
    if (type === "in-vitro") {
        return count === 1 ? "1 in-vitro" : `${count} in-vitro`;
    }
    const label = EVIDENCE_TYPE_LABELS[type].toLowerCase();
    return count === 1 ? `1 ${label}` : `${count} ${label}s`;
}

export function evidenceMixLabel(
    extractions: Array<{ evidenceType?: string }> | undefined,
): string {
    if (!extractions || extractions.length === 0) return "";
    const counts = new Map<EvidenceType, number>();
    for (const item of extractions) {
        const type = isEvidenceType(item.evidenceType)
            ? item.evidenceType
            : "other";
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return EVIDENCE_TYPE_ORDER.filter((type) => (counts.get(type) ?? 0) > 0)
        .map((type) => pluralizeEvidence(type, counts.get(type) ?? 0))
        .join(" · ");
}
