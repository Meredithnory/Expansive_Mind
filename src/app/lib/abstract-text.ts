export const abstractToText = (abstract: unknown): string => {
    if (!abstract) return "";
    if (typeof abstract === "string") return abstract;
    if (Array.isArray(abstract)) {
        return abstract
            .map((item) =>
                typeof item === "string" ? item : abstractToText(item),
            )
            .join(" ");
    }
    if (typeof abstract === "object") {
        const paragraphs = (abstract as { p?: string | string[] }).p;
        if (paragraphs) {
            return abstractToText(paragraphs);
        }

        return Object.values(abstract)
            .filter(
                (value) =>
                    typeof value === "string" ||
                    Array.isArray(value) ||
                    (value && typeof value === "object"),
            )
            .map((value) =>
                abstractToText(
                    value as string | string[] | Record<string, unknown>,
                ),
            )
            .join(" ");
    }

    return "";
};
