"use client";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./searchpaper.module.scss";
import SearchResults from "../components/SearchResults";
import Loading from "../components/Loading";
import NavBar from "../components/NavBar";
import Image from "next/image";

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
    //Tracking which page we're on and how many pages exist
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
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

    const doSearch = async (query: string, page: number = 0): Promise<void> => {
        setLoading(true);
        const params = new URLSearchParams({
            q: query,
            page: String(page),
        });
        //Using the same params to send to the back-end
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        //If page = 0, replace results; otherwise append
        setSearchResults(data.results);
        setPastSearchValue(query);
        setTotalPages(data.totalPages); // store total pages from backend
        setCurrentPage(page); //store current page
        setLoading(false);
    };

    useEffect(() => {
        setSearchValue(qParam ?? "");
        if (qParam) {
            doSearch(qParam, 0);
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
                        <div className={styles.datasource}>
                            <small>
                                Data Source: Search results are retrieved from{" "}
                                <a
                                    href="https://www.ncbi.nlm.nih.gov/pmc/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    NIH PubMed Central (PMC)
                                </a>
                            </small>
                        </div>
                        <div className={styles.pagination}>
                            <button
                                className={styles.prevbutton}
                                disabled={currentPage === 0 || loading}
                                onClick={() =>
                                    doSearch(searchValue, currentPage - 1)
                                }
                            >
                                <Image
                                    className={styles.icon}
                                    width={1000}
                                    height={760}
                                    src="/previcon.svg"
                                    alt="prevArrow"
                                />
                            </button>

                            <div className={styles.currentpage}>
                                Page {currentPage + 1} of {totalPages}
                            </div>
                            <button
                                disabled={
                                    currentPage >= totalPages - 1 || loading
                                }
                                onClick={() =>
                                    doSearch(searchValue, currentPage + 1)
                                }
                                className={styles.nextbutton}
                            >
                                <Image
                                    className={styles.icon}
                                    width={1000}
                                    height={760}
                                    src="/nexticon.svg"
                                    alt="nextArrow"
                                />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default page;
