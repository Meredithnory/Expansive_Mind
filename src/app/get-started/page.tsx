"use client";
import React from "react";
import { useState } from "react";
import styles from "./get-started.module.scss";
import SearchBar from "../components/SearchBar";
import { redirect } from "next/navigation";
import NavBar from "../components/NavBar";

export default function SearchPage() {
    const [searchValue, setSearchValue] = useState("");

    const handleSearch = () => {
        if (searchValue) {
            redirect(`/searchpaper?q=${searchValue}`);
        }
    };

    return (
        <div className={styles.page}>
            <NavBar />
            <div className={styles.box}>
                <div className={styles.title}>
                    What research topic would you like to expand your mind?
                </div>
                <SearchBar
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    handleSubmit={handleSearch}
                />
            </div>
        </div>
    );
}
