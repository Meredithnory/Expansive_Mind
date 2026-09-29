// Fetch for admin pages: JSON in, a readable Error out.
export async function adminApi<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, { cache: "no-store", ...options });
    const text = await response.text();
    let data: { error?: string; message?: string } = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(
                response.ok
                    ? "The server returned an unexpected response."
                    : `Request failed (${response.status}).`,
            );
        }
    }
    if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed (${response.status}).`);
    }
    return data as T;
}

export function postJson(method: "POST" | "PATCH", body: unknown): RequestInit {
    return {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}
