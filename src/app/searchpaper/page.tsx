import { Suspense } from "react";
import RouteLoading from "../components/RouteLoading";
import SearchPaperClient from "./SearchPaperClient";
import styles from "./searchpaper.module.scss";

type SearchPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function SearchPaperPage({ searchParams }: SearchPageProps) {
    const query = await searchParams;

    // Search stays behind its route handler so guest quotas and usage accounting
    // continue to run exactly once per user-initiated request.
    return (
        <Suspense fallback={<RouteLoading label="Loading paper search…" />}>
            <SearchPaperClient
                initialQuery={first(query.q)}
                initialPage={first(query.page)}
                initialSource={first(query.source)}
                landingIntro={
                    <>
                        <p className={styles.landingEyebrow}>Research belongs to everyone</p>
                        <h1 className={styles.landingTitle}>
                            What research topic would you like to{" "}
                            <span className={styles.landingTitleAccent}>expand your mind</span>?
                        </h1>
                        <p className={styles.landingSubtitle}>
                            Looking for a specific paper or topic? Search the literature directly,
                            then open any result to read it.
                        </p>
                    </>
                }
            />
        </Suspense>
    );
}
