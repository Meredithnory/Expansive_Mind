import { redirect } from "next/navigation";
import { researchHref } from "../lib/research-mode";

type SearchPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPaperPage({ searchParams }: SearchPageProps) {
    const query = await searchParams;

    // Search now lives on the combined research page under Discovery | Search.
    redirect(
        researchHref("search", {
            q: first(query.q) || undefined,
            page: first(query.page) || undefined,
            source: first(query.source) || undefined,
            date: first(query.date) || undefined,
        }),
    );
}
