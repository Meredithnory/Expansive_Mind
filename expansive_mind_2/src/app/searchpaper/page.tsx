"use client";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./searchpaper.module.scss";
import SearchResults from "../components/SearchResults";
import Loading from "../components/Loading";
import NavBar from "../components/NavBar";

interface SearchResult {
    pmcid: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string;
}

const page = () => {
    //Get query params in the URL from the get-started page FIRST
    const searchParams = useSearchParams();
    const qParam = searchParams.get("q");
    //Router is accessing information of the router historys array but now we want to use router to change the history to the current params to where it started in the get-started page in case someone
    const router = useRouter();

    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searchValue, setSearchValue] = useState(qParam ?? "");
    const [loading, setLoading] = useState(true);
    //Last handle submit value shown for the showing results : " " that way it only changes when its submitted
    const [pastSearchValue, setPastSearchValue] = useState("");

    const handleSubmit = (): void => {
        const params = new URLSearchParams({
            q: searchValue,
        });
        //Pushing the query search parameter in the URL 's history arr
        const href = `${window.location.pathname}?${params}`;
        router.push(href, { scroll: false });
    };

    const doSearch = async (query: string): Promise<void> => {
        setLoading(true);
        const params = new URLSearchParams({
            q: query,
        });
        //Using the same params to send to the back-end
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        setSearchResults(data.results);
        setPastSearchValue(query);
        setLoading(false);
    };

    useEffect(() => {
        setSearchValue(qParam ?? "");
        if (qParam) {
            doSearch(qParam);
        }
    }, [qParam]);

    return (
        <div className={styles.page}>
            <NavBar />
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
