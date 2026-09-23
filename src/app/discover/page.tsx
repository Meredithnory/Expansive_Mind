import { Suspense } from "react";
import RouteLoading from "../components/RouteLoading";
import ResearchWorkspace from "./ResearchWorkspace";

type DiscoverPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
    const query = await searchParams;

    // Discovery and Search share this route; mode lives in ?mode=discover|search.
    // Route handlers still own quotas, persistence, and usage accounting separately.
    return (
        <Suspense fallback={<RouteLoading label="Opening research workspace…" />}>
            <ResearchWorkspace
                modeParam={first(query.mode)}
                qParam={first(query.q)}
                savedParam={first(query.saved)}
                pageParam={first(query.page)}
                sourceParam={first(query.source)}
                dateParam={first(query.date)}
            />
        </Suspense>
    );
}
