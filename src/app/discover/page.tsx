import { Suspense } from "react";
import RouteLoading from "../components/RouteLoading";
import DiscoverClient from "./DiscoverClient";
import styles from "./discover.module.scss";

type DiscoverPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
    const query = await searchParams;

    // Discovery history and generation remain in the client island because the
    // route handler owns guest quotas, persistence, and usage accounting.
    return (
        <Suspense fallback={<RouteLoading label="Opening discovery workspace…" />}>
            <DiscoverClient
                qParam={first(query.q)}
                savedParam={first(query.saved)}
                hero={
                    <>
                        <p className={styles.eyebrow}>Evidence-grounded research agent</p>
                        <h1 className={styles.title}>
                            Explore biomedical research and startup opportunities
                        </h1>
                        <p className={styles.subtitle}>
                            Ask one research question. Get cited scientific findings,
                            research gaps, ranked startup opportunities, and revenue
                            and funding scenarios together. Financial estimates use
                            explicit assumptions; missing evidence stays visible.
                        </p>
                    </>
                }
            />
        </Suspense>
    );
}
