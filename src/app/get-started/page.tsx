"use client";
import React from "react";
import { useState } from "react";
import styles from "./get-started.module.scss";
import SearchBar from "../components/SearchBar";
import { useRouter } from "next/navigation";
import NavBar from "../components/NavBar";

export default function SearchPage() {
    const [searchValue, setSearchValue] = useState("");
    const router = useRouter();

    const handleSearch = () => {
        if (searchValue) {
            router.push(`/searchpaper?q=${encodeURIComponent(searchValue)}`);
        }
    };

    return (
        <div className={styles.box}>
            <div className={styles.title}>
                What research topic would you like to expand your mind?
            </div>
            <SearchBar
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                handleSubmit={handleSearch}
            />
            <div className={styles.dbblock}>
                <span className={styles.text}>Databases</span>
                <button
                    className={`${styles.databaseCard} ${styles.databases}`}
                >
                    NIH PubMed Central (PMC)
                </button>
                <button className={`${styles.databaseCard} ${styles.dbnature}`}>
                    Nature (Springer Nature)
                </button>
                <button
                    className={`${styles.databaseCard} ${styles.comingSoon2}`}
                >
                    🚧 Coming Soon
                </button>
            </div>
        </div>
    );
}
