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

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = cookies.get("auth_token");
        setIsLoggedIn(!!token);
    }, []);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleLogout = () => {
        cookies.remove("auth_token");
        router.push("/");
    };

    return (
        <>
            {isMenuOpen === true && (
                <NavigationMenu
                    isLoggedIn={isLoggedIn}
                    handleLogout={handleLogout}
                />
            )}
            <button className={styles.button} onClick={toggleMenu}>
                <Image
                    className={styles.icon}
                    width={1000}
                    height={760}
                    src="/hamburgericon.svg"
                    alt="HambugerIcon"
                />
            </button>
        </>
    );
};

export default HamburgerIcon;
