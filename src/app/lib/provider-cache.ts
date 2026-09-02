import "server-only";
import { createHash } from "crypto";
import connectDB from "../db/connectDB";
import ProviderCache from "../models/ProviderCache";

const pending = new Map<string, Promise<unknown>>();

function cacheId(namespace: string, key: string) {
    return createHash("sha256")
        .update(`${namespace}:${key}`)
        .digest("hex");
}

export async function getCachedValue<T>(namespace: string, key: string) {
    await connectDB();
    const record = await ProviderCache.findOne({
        _id: cacheId(namespace, key),
        expiresAt: { $gt: new Date() },
    }).lean<{ value: T }>();
    return record?.value ?? null;
}

export async function setCachedValue<T>(
    namespace: string,
    key: string,
    value: T,
    ttlSeconds: number,
) {
    await connectDB();
    await ProviderCache.findOneAndUpdate(
        { _id: cacheId(namespace, key) },
        {
            $set: {
                namespace,
                value,
                expiresAt: new Date(Date.now() + ttlSeconds * 1_000),
            },
        },
        { upsert: true },
    );
}

export async function cached<T>(input: {
    namespace: string;
    key: string;
    ttlSeconds: number;
    load: () => Promise<T>;
}) {
    const id = cacheId(input.namespace, input.key);
    let hit: T | null = null;
    try {
        hit = await getCachedValue<T>(input.namespace, input.key);
    } catch (error) {
        console.warn("Provider cache read failed", error);
    }
    if (hit !== null) return { value: hit, cacheHit: true };

    const existing = pending.get(id) as Promise<T> | undefined;
    if (existing) return { value: await existing, cacheHit: true };

    const request = input.load();
    pending.set(id, request);
    try {
        const value = await request;
        try {
            await setCachedValue(
                input.namespace,
                input.key,
                value,
                input.ttlSeconds,
            );
        } catch (error) {
            console.warn("Provider cache write failed", error);
        }
        return { value, cacheHit: false };
    } finally {
        pending.delete(id);
    }
}
