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
                        <p className={styles.eyebrow}>Cross-database research agent</p>
                        <h1 className={styles.title}>Discover across papers</h1>
                        <p className={styles.subtitle}>
                            Ask a biomedical question. Deep analysis reads up to 10 papers and can
                            take a minute or two, then returns a cited opportunity report: what the
                            science says, where the gaps are, and what those gaps could become.
                        </p>
                    </>
                }
            />
        </Suspense>
    );
}
