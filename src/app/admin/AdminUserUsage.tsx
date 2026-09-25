import { QUOTA_LABELS } from "../lib/quota-period";

export type AdminUsageCell = {
    feature: string;
    used: number;
    limit: number;
};

export function adminUsageCells(usage: unknown): AdminUsageCell[] {
    if (!Array.isArray(usage)) return [];
    return usage.flatMap((cell) => {
        if (!cell || typeof cell !== "object") return [];
        const row = cell as Record<string, unknown>;
        if (typeof row.feature !== "string" || typeof row.used !== "number") {
            return [];
        }
        return [
            {
                feature: row.feature,
                used: row.used,
                limit: typeof row.limit === "number" ? row.limit : 0,
            },
        ];
    });
}

function labelFor(feature: string) {
    if (Object.prototype.hasOwnProperty.call(QUOTA_LABELS, feature)) {
        return QUOTA_LABELS[feature as keyof typeof QUOTA_LABELS];
    }
    return feature.replaceAll("_", " ");
}

export function AdminUserUsage({ usage }: { usage: unknown }) {
    return adminUsageCells(usage).map((cell) => (
        <div key={cell.feature}>
            {labelFor(cell.feature)}: {cell.used}/{cell.limit}
        </div>
    ));
}
