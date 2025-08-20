"use client";
import React, { useEffect } from "react";
import styles from "./hamburgericon.module.scss";
import Image from "next/image";
import { useState } from "react";
import NavigationMenu from "./NavigationMenu";
import { useCookies } from "next-client-cookies";
import { useRouter } from "next/navigation";

const HamburgerIcon = () => {
    const cookies = useCookies();
    const router = useRouter();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = cookies.get("auth_token");
        setIsLoggedIn(!!token);
    }, []);

    const handleLogout = () => {
        cookies.remove("auth_token");
        router.push("/");
    };

    return (
        <>
            <NavigationMenu
                isLoggedIn={isLoggedIn}
                handleLogout={handleLogout}
            />
        </>
    );
};

export default HamburgerIcon;
