"use client";
import React from "react";
import { useState } from "react";
import styles from "./get-started.module.scss";
import SearchBar from "../components/SearchBar";
import HamburgerIcon from "../components/HamburgerIcon";
import { redirect } from "next/navigation";
import Title from "../components/Title";

export default function SearchPage() {
    const [searchValue, setSearchValue] = useState("");

    const handleSearch = () => {
        if (searchValue) {
            redirect(`/searchpaper?q=${searchValue}`);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.navbar}>
                <Title />
                <HamburgerIcon />
            </div>
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
