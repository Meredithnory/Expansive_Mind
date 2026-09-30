export type Person = {
    id: string;
    name: string;
    profileColor: string | null;
    badge?: import("../lib/lab-badge").Badge;
};

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

/** "Joined September 2026" for a profile; month and year only, in UTC. */
export function joinedLabel(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const month = new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
    return `Joined ${month}`;
}

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
