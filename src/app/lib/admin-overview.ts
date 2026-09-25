export type UsageRow = {
    feature: string;
    provider: string;
    calls: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd: number;
    failures: number;
};

export type DailyPoint = {
    date: string;
    calls: number;
    costUsd: number;
    failures: number;
    features: Record<string, { calls: number; costUsd: number }>;
};

export type PriorUsage = {
    calls: number;
    estimatedCostUsd: number;
    failures: number;
};

const FEATURE_LABELS: Record<string, string> = {
    discover: "Discovery",
    chat: "Paper chat",
    search: "Search",
    scholar_search: "Scholar search",
    paper: "Paper fetch",
    projects: "Projects",
    transcription: "Voice",
};

const PROVIDER_LABELS: Record<string, string> = {
    openrouter: "OpenRouter",
    springer: "Springer",
    literature_apis: "Literature APIs",
    serpapi: "SerpAPI",
    nih: "NIH",
};

export const FEATURE_COLORS: Record<string, string> = {
    discover: "#ff168f",
    chat: "#b45cff",
    search: "#0ab1ff",
    scholar_search: "#3dd6c6",
    paper: "#f4d98a",
    projects: "#ff8a4c",
    transcription: "#7dd3fc",
};

export function featureLabel(feature: string) {
    return FEATURE_LABELS[feature] || feature.replaceAll("_", " ");
}

export function providerLabel(provider: string) {
    return PROVIDER_LABELS[provider] || provider.replaceAll("_", " ");
}

export function featureColor(feature: string) {
    if (FEATURE_COLORS[feature]) return FEATURE_COLORS[feature];
    let hash = 0;
    for (let index = 0; index < feature.length; index += 1) {
        hash = feature.charCodeAt(index) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 340} 62% 62%)`;
}

export function utcDayKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function eachUtcDay(days: number, end = new Date()) {
    const endUtc = Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        end.getUTCDate(),
    );
    return Array.from({ length: days }, (_, index) =>
        new Date(endUtc - (days - 1 - index) * 86_400_000)
            .toISOString()
            .slice(0, 10),
    );
}

export function fillDailySeries(
    rows: DailyPoint[],
    days = 30,
    end = new Date(),
): DailyPoint[] {
    const byDate = new Map(rows.map((row) => [row.date, row]));
    return eachUtcDay(days, end).map((date) => {
        const row = byDate.get(date);
        return {
            date,
            calls: row?.calls ?? 0,
            costUsd: row?.costUsd ?? 0,
            failures: row?.failures ?? 0,
            features: row?.features ?? {},
        };
    });
}

export function percentChange(current: number, prior: number) {
    if (prior === 0) return current === 0 ? 0 : null;
    return ((current - prior) / Math.abs(prior)) * 100;
}

export function successRate(calls: number, failures: number) {
    if (calls <= 0) return 1;
    return Math.max(0, (calls - failures) / calls);
}

export function shareOf(part: number, total: number) {
    if (total <= 0) return 0;
    return part / total;
}

export function formatUsd(value: number, digits = 2) {
    const abs = Math.abs(value);
    const resolved = abs >= 1 ? digits : abs >= 0.01 ? 3 : 4;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: resolved,
        maximumFractionDigits: resolved,
    }).format(value);
}

export function formatCompact(value: number) {
    return new Intl.NumberFormat("en-US", {
        notation: value >= 1000 ? "compact" : "standard",
        maximumFractionDigits: value >= 1000 ? 1 : 0,
    }).format(value);
}

export function chartPolyline(
    values: number[],
    width: number,
    height: number,
    pad = 4,
) {
    if (!values.length) return "";
    const max = Math.max(...values, 0.0001);
    return values
        .map((value, index) => {
            const x =
                pad +
                (values.length === 1
                    ? (width - pad * 2) / 2
                    : (index / (values.length - 1)) * (width - pad * 2));
            const y = height - pad - (value / max) * (height - pad * 2);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
}

export function areaPath(values: number[], width: number, height: number, pad = 8) {
    const line = chartPolyline(values, width, height, pad);
    if (!line) return "";
    return `${line} L${width - pad} ${height - pad} L${pad} ${height - pad} Z`;
}
