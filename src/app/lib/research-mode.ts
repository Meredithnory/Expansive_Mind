export type ResearchMode = "discover" | "search";

export const RESEARCH_PATH = "/discover";

export function parseResearchMode(
    value: string | string[] | undefined | null,
): ResearchMode {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw === "search" ? "search" : "discover";
}

export function researchHref(
    mode: ResearchMode,
    extra?: Record<string, string | undefined | null>,
): string {
    const params = new URLSearchParams();
    if (mode === "search") {
        params.set("mode", "search");
    }
    if (extra) {
        for (const [key, value] of Object.entries(extra)) {
            if (!value) continue;
            if (key === "mode") continue;
            params.set(key, value);
        }
    }
    const query = params.toString();
    return query ? `${RESEARCH_PATH}?${query}` : RESEARCH_PATH;
}

export function buildResearchModeUrl(
    mode: ResearchMode,
    current: URLSearchParams | Record<string, string | string[] | undefined>,
): string {
    const source =
        typeof (current as URLSearchParams).get === "function" &&
        typeof (current as URLSearchParams).toString === "function" &&
        !Array.isArray(current)
            ? new URLSearchParams((current as URLSearchParams).toString())
            : new URLSearchParams(
                  Object.entries(
                      current as Record<string, string | string[] | undefined>,
                  ).flatMap(([key, value]) => {
                      if (value == null || value === "") return [];
                      if (Array.isArray(value)) {
                          return value[0] ? [[key, value[0]]] : [];
                      }
                      return [[key, value]];
                  }),
              );

    const params = new URLSearchParams();
    const q = source.get("q");
    if (q) params.set("q", q);

    if (mode === "search") {
        params.set("mode", "search");
        for (const key of ["page", "source", "date"] as const) {
            const value = source.get(key);
            if (value) params.set(key, value);
        }
    } else {
        const saved = source.get("saved");
        if (saved) params.set("saved", saved);
    }

    const query = params.toString();
    return query ? `${RESEARCH_PATH}?${query}` : RESEARCH_PATH;
}
