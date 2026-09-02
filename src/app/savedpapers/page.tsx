import { Suspense } from "react";
import Link from "next/link";
import RouteLoading from "../components/RouteLoading";
import SavedLibraryClient from "./SavedLibraryClient";
import styles from "./savedpage.module.scss";

type LibraryTab = "papers" | "syntheses" | "projects";
type SavedPapersPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function initialTab(value: string | string[] | undefined): LibraryTab {
    const tab = Array.isArray(value) ? value[0] : value;
    return tab === "syntheses" || tab === "projects" ? tab : "papers";
}

export default async function SavedPapersPage({ searchParams }: SavedPapersPageProps) {
    const query = await searchParams;

    // Account-scoped library reads remain behind authenticated route handlers;
    // the shell can still render immediately while those independent reads run.
    return (
        <div className={styles.pagecontainer}>
            <div className={styles.pagecontent}>
                <Suspense fallback={<RouteLoading label="Loading your research library…" />}>
                    <SavedLibraryClient
                        initialTab={initialTab(query.tab)}
                        header={
                            <header className={styles.libraryHeader}>
                                <div>
                                    <p className={styles.eyebrow}>Your workspace</p>
                                    <h1>Research Library</h1>
                                    <p>
                                        Papers you read, topic syntheses you generated, and research
                                        plans you are moving forward.
                                    </p>
                                </div>
                                <Link href="/discover" className={styles.searchButton}>
                                    Start a discovery
                                </Link>
                            </header>
                        }
                    />
                </Suspense>
            </div>
        </div>
    );
}
