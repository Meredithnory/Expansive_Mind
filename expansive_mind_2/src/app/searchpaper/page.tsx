"use client";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { useSearchParams } from "next/navigation";
import HamburgerIcon from "../components/HamburgerIcon";
import Title from "../components/Title";
import styles from "./searchpaper.module.scss";
import SearchResults from "../components/SearchResults";
import Loading from "../components/Loading";

interface SearchResult {
    pmid: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string;
}

const page = () => {
    const searchParams = useSearchParams();
    const search = searchParams.get("q");

    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchValue, setSearchValue] = useState(search ?? "");
    const [loading, setLoading] = useState(true);
    const [pastSearchValue, setPastSearchValue] = useState("");

    const handleSubmit = async () => {
        setLoading(true);
        const params = new URLSearchParams({
            q: searchValue,
        });
        console.log(searchValue);
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        console.log(data);
        setSearchResults(data.results);
        setPastSearchValue(searchValue);
        setLoading(false);
    };

    useEffect(() => {
        if (search) {
            handleSubmit();
        }
    }, [search]);

    return (
        <div className={styles.page}>
            <div className={styles.navbar}>
                <Title />
                <HamburgerIcon />
            </div>
            <div className={styles.searchbox}>
                <SearchBar
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    handleSubmit={handleSubmit}
                    className={styles.searchbar}
                />
                {loading ? (
                    <Loading />
                ) : (
                    <>
                        <div className={styles.showingResults}>
                            Showing results for "{pastSearchValue}" :
                        </div>
                        <SearchResults
                            searchResults={searchResults}
                            searchValue={pastSearchValue}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default page;
