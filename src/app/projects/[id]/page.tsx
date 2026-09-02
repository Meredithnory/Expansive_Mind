import { Suspense } from "react";
import RouteLoading from "../../components/RouteLoading";
import ProjectDetailClient from "./ProjectDetailClient";
import styles from "./project-detail.module.scss";

type ProjectDetailPageProps = {
    params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
    const { id } = await params;

    // Project reads and mutations remain behind their authenticated handlers.
    return (
        <Suspense fallback={<RouteLoading label="Loading research project…" />}>
            <ProjectDetailClient
                projectId={id}
                loadingHeader={
                    <div className={styles.content}>
                        <header className={styles.header}>
                            <div>
                                <p className={styles.meta}>Research project</p>
                                <h1 className={styles.title}>Loading your research roadmap…</h1>
                            </div>
                        </header>
                    </div>
                }
            />
        </Suspense>
    );
}
