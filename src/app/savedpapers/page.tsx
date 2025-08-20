"use client";
import React, { useEffect, useState } from "react";
import SavedPaper from "../components/SavedPaper";
import styles from "./savedpage.module.scss";
import Link from "next/link";
import NavBar from "../components/NavBar";
import Loading from "../components/Loading";

const page = () => {
    // create state for the users saved papers
    const [allPapers, setAllPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noPaper, setNoPaper] = useState(false);
    // create function to call api and fetch papers
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
    // update noPaper whenever allPapers changes - preventing infinite render-state-loops
    useEffect(() => {
        setNoPaper(Array.isArray(allPapers) && allPapers.length === 0);
    }, [allPapers]);
    //delete paper function in the parent
    async function deletePaper(id: string) {
        setAllPapers((prev) => prev.filter((paper: any) => paper._id !== id));

        try {
            const res = await fetch("/api/delete-paper", {
                method: "DELETE",
                body: JSON.stringify({ id }),
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

    return (
        <div className={styles.pagecontainer}>
            <NavBar />
            <div className={styles.pagecontent}>
                <div className={styles.titletext}>
                    <h2>Saved Papers</h2>
                </div>
                {loading ? (
                    <div className={styles.loader}>
                        <Loading />
                    </div>
                ) : noPaper ? (
                    <div className={styles.text}>
                        <h2>Oops! No papers here!</h2>
                        <div>
                            Head to the{" "}
                            <Link href="/get-started">Get Started</Link> page
                            and select a paper you'd like to chat with.
                        </div>
                    </div>
                ) : (
                    <div className={styles.allpapers}>
                        {allPapers.map((page) => (
                            <SavedPaper
                                key={page.id}
                                page={page}
                                isLink={true}
                                deletePaper={deletePaper}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default page;
