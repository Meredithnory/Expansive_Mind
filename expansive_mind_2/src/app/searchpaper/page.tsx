"use client";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { useSearchParams } from "next/navigation";
import HamburgerIcon from "../components/HamburgerIcon";
import Title from "../components/Title";
import styles from "./searchpaper.module.scss";
import Filterbox from "../components/Filterbox";
import SearchResults from "../components/SearchResults";
const page = () => {
    const searchParams = useSearchParams();
    const search = searchParams.get("q");

    const [searchValue, setSearchValue] = useState(search ?? "");

    const handleSubmit = () => {
        const params = new URLSearchParams({
            q: searchValue,
        });
        console.log(searchValue);
        fetch(`/api/search?${params}`)
            .then((resp) => resp.json())
            .then((data: any) => {
                console.log(data);
            });
    };

    useEffect(() => {
        handleSubmit();
    }, []);

    return (
        <div className={styles.page}>
            <div className={styles.navbar}>
                <Title />
                <HamburgerIcon />
            </div>
            <div className={styles.searchpage}>
                <Filterbox />
                <div className={styles.searchbox}>
                    <SearchBar
                        searchValue={searchValue}
                        setSearchValue={setSearchValue}
                        handleSubmit={handleSubmit}
                        className={styles.searchbar}
                    />
                    <SearchResults />
                </div>
                <div />
            </div>
        </div>
    );
};

export default page;
