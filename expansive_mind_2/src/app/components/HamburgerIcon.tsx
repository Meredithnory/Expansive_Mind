"use client";
import React from "react";
import styles from "./hamburgericon.module.scss";
import Image from "next/image";
import { useState } from "react";
import NavigationMenu from "./NavigationMenu";
const HamburgerIcon = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <>
            {isMenuOpen === true && <NavigationMenu />}
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
