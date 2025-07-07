"use client";
import React, { useEffect, useState } from "react";
import SavedPaper, { Paper } from "../components/SavedPaper";
import styles from "./savedpage.module.scss";
import NavBar from "../components/NavBar";
import Loading from "../components/Loading";

const page = () => {
    // create state for the users saved papers
    const [allPapers, setAllPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    // create function to call api and fetch papers
    const fetchAllPapers = async () => {
        setLoading(true);
        const res = await fetch("/api/all-user-papers");
        const data = await res.json();
        setAllPapers(data.papers);
        setLoading(false);
    };
    // on use effect call that function to fetch papers
    useEffect(() => {
        fetchAllPapers();
    }, []);

    return (
        <div className={styles.pagecontainer}>
            <NavBar />
            <div className={styles.pagecontent}>
                <h2>Saved Papers</h2>
                {loading ? (
                    <div className={styles.loader}>
                        <Loading />
                    </div>
                ) : (
                    <div className={styles.allpapers}>
                        {allPapers.map((page) => (
                            <SavedPaper
                                key={page.id}
                                page={page}
                                isLink={true}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default page;
