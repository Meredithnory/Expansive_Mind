"use client";
import React, { useEffect } from "react";
import { useState } from "react";
import NavigationMenu from "./NavigationMenu";
import { useCookies } from "next-client-cookies";
import { useRouter, usePathname } from "next/navigation";
import styles from "./styles/navbar.module.scss";
import Title from "./Title";

const NavBar = () => {
    const cookies = useCookies();
    const router = useRouter();
    const pathname = usePathname();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const token = cookies.get("auth_token");

    useEffect(() => {
        setIsLoggedIn(!!token);
    }, [token]);

    const handleLogout = () => {
        cookies.remove("auth_token");
        router.push("/");
    };
    //end early rendering if it is the homepage
    if (pathname === "/") {
        return null;
    }
    console.log(isLoggedIn);
    return (
        <div className={styles.navbar}>
            <Title />
            <NavigationMenu
                isLoggedIn={isLoggedIn}
                handleLogout={handleLogout}
            />
        </div>
    );
};

export default NavBar;
