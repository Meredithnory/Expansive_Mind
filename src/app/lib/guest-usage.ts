import type { QuotaFeature } from "./plan-config";

export type GuestCounterRecord = {
    identityHash: string;
    feature: string;
    count: number;
    updatedAt?: string;
};

export type GuestNetworkUsage = {
    fingerprint: string;
    discoverUsed: number;
    discoverLimit: number;
    chatUsed: number;
    chatLimit: number;
    searchUsed: number;
    searchLimit: number;
    lastSeen: string;
    exhausted: boolean;
};

export function summarizeGuestCounters(
    records: GuestCounterRecord[],
    entitlements: Record<QuotaFeature, number>,
): GuestNetworkUsage[] {
    const byHash = new Map<string, GuestNetworkUsage>();

    for (const record of records) {
        const current = byHash.get(record.identityHash) ?? {
            fingerprint: record.identityHash.slice(0, 12),
            discoverUsed: 0,
            discoverLimit: entitlements.discover,
            chatUsed: 0,
            chatLimit: entitlements.chat,
            searchUsed: 0,
            searchLimit: entitlements.search,
            lastSeen: record.updatedAt ?? "",
            exhausted: false,
        };

        if (record.feature === "discover") current.discoverUsed = record.count;
        if (record.feature === "chat") current.chatUsed = record.count;
        if (record.feature === "search") current.searchUsed = record.count;
        if (record.updatedAt && record.updatedAt > current.lastSeen) {
            current.lastSeen = record.updatedAt;
        }
        current.exhausted =
            current.discoverUsed >= current.discoverLimit &&
            current.chatUsed >= current.chatLimit;
        byHash.set(record.identityHash, current);
    }

    return [...byHash.values()].sort((left, right) =>
        left.lastSeen < right.lastSeen ? 1 : -1,
    );
}
