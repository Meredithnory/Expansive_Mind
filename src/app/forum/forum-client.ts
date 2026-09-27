export type Person = { id: string; name: string; profileColor: string | null };

export type ForumPost = {
    id: string;
    author: Person;
    paper: { title: string; href: string };
    body: string;
    tags: string[];
    quotable: boolean;
    commentCount: number;
    createdAt: string;
    status?: "visible" | "hidden" | "removed";
    canDelete: boolean;
    highlights: Array<{
        id: string;
        excerpt: string | null;
        sectionTitle: string;
        color: string;
        href: string;
    }>;
};

export const when = (value: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
        new Date(value),
    );

export async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || data.message || "Something went wrong.");
    }
    return data;
}
