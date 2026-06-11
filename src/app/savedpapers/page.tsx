"use client";
import React, { useEffect, useState } from "react";
import SavedPaper from "../components/SavedPaper";
import { Paper } from "../components/SavedPaper";
import styles from "./savedpage.module.scss";
import Link from "next/link";
import NavBar from "../components/NavBar";
import Loading from "../components/Loading";

const PAPERS_PER_PAGE = 6;

const page = () => {
    // Source of truth for all saved papers returned by the API.
    const [allPapers, setAllPapers] = useState<Paper[]>([]);
    const [loading, setLoading] = useState(true);
    // UI page index for client-side pagination.
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch all user papers once and whenever we need to refresh after a mutation.
    const fetchAllPapers = async () => {
        setLoading(true);
        const res = await fetch("/api/all-user-papers");
        const data = await res.json();
        setAllPapers(data.papers);
        setLoading(false);
    };

    //Fetch all papers once on mount
    useEffect(() => {
        fetchAllPapers();
    }, []);
    const hasNoPapers = allPapers.length === 0;

    // Keep at least one page so the pagination bar can always render.
    const totalPages = Math.max(
        1,
        Math.ceil(allPapers.length / PAPERS_PER_PAGE),
    );

    // If papers are deleted and total pages shrink, clamp current page to a valid value.
    useEffect(() => {
        setCurrentPage((prev) => Math.min(prev, totalPages));
    }, [totalPages]);

    // Compute the paper slice shown on the current UI page.
    const startIndex = (currentPage - 1) * PAPERS_PER_PAGE;
    const visiblePapers = allPapers.slice(
        startIndex,
        startIndex + PAPERS_PER_PAGE,
    );

    // Optimistic delete: update UI first, then sync with backend and re-fetch for safety.
    async function deletePaper(paper: Paper) {
        setAllPapers((prev) =>
            prev.filter(
                (saved) =>
                    !(
                        saved.paperId === paper.paperId &&
                        saved.idName === paper.idName &&
                        saved.primarySource === paper.primarySource
                    ),
            ),
        );

        try {
            const res = await fetch("/api/delete-paper", {
                method: "DELETE",
                body: JSON.stringify({
                    primarySource: paper.primarySource,
                    paperId: paper.paperId,
                    idName: paper.idName,
                }),
            });
            const data = await res.json();
            if (data.success) {
                fetchAllPapers();
            }
            if (!data.success) {
                console.error("Failed to delete paper:", data.error);
                fetchAllPapers();
            }
        } catch (err) {
            console.error("Error deleting paper:", err);
            fetchAllPapers();
        }
    }

    if (loading) {
        return (
            <div className="full-height-loading">
                <Loading />
            </div>
        );
    }
    return (
        <div className={styles.pagecontainer}>
            <div className={styles.pagecontent}>
                <div className={styles.titletext}>
                    <h2>My Papers</h2>
                </div>
                {hasNoPapers ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyTitle}>No saved papers yet</p>
                        <p className={styles.emptyMessage}>
                            Search for a research topic, open a paper you like,
                            and save it here so you can chat with it anytime.
                        </p>
                        <Link href="/get-started" className={styles.searchButton}>
                            Search papers
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className={styles.allpapers}>
                            {visiblePapers.map((page) => (
                                <SavedPaper
                                    key={`${page.primarySource}-${page.idName}-${page.paperId}`}
                                    page={page}
                                    isLink={true}
                                    deletePaper={deletePaper}
                                />
                            ))}
                        </div>

                        {/* Intentionally always shown so users can see page context, even on 1 page. */}
                        <div className={styles.pagination}>
                            <button
                                className={styles.pagebutton}
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(prev - 1, 1),
                                    )
                                }
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>

                            <span className={styles.pagenumber}>
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                className={styles.pagebutton}
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(prev + 1, totalPages),
                                    )
                                }
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default page;
