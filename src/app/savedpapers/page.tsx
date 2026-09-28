import { Suspense } from "react";
import RouteLoading from "../components/RouteLoading";
import SavedLibraryClient from "./SavedLibraryClient";
import { parseLibraryTab } from "./library-view";
import styles from "./savedpage.module.scss";

type SavedPapersPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SavedPapersPage({ searchParams }: SavedPapersPageProps) {
    const query = await searchParams;

    // Account-scoped library reads remain behind authenticated route handlers;
    // the shell can still render immediately while those independent reads run.
    return (
        <div className={styles.pagecontainer}>
            <div className={styles.pagecontent}>
                <Suspense fallback={<RouteLoading label="Loading your research library…" />}>
                    <SavedLibraryClient initialTab={parseLibraryTab(query.tab)} />
                </Suspense>
            </div>
        </div>
    );
}
