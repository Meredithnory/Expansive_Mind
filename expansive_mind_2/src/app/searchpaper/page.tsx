"use client";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import { useSearchParams } from "next/navigation";
import HamburgerIcon from "../components/HamburgerIcon";

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
        <div>
            <SearchBar
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                handleSubmit={handleSubmit}
            />
            <HamburgerIcon />
        </div>
    );
};

export default page;
