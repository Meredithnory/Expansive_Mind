import "server-only";

const FETCH_MS = 15_000;

export async function providerFetch(
    url: URL,
    init?: RequestInit,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_MS);
    try {
        return await fetch(url, {
            ...init,
            signal: controller.signal,
            cache: "no-store",
        });
    } finally {
        clearTimeout(timer);
    }
}

export async function providerFetchJson<T>(url: URL): Promise<T | null> {
    const response = await providerFetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
}

export async function providerFetchText(url: URL): Promise<string | null> {
    const response = await providerFetch(url);
    if (!response.ok) return null;
    return response.text();
}
