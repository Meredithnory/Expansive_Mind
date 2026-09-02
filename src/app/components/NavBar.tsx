"use client";
import React, { useEffect, useLayoutEffect, useState } from "react";
import NavigationMenu from "./NavigationMenu";
import { useRouter, usePathname } from "next/navigation";
import styles from "./styles/navbar.module.scss";
import Title from "./Title";
import { useSession } from "../lib/use-session";

function resetWindowScroll() {
    if (typeof window === "undefined") return;
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector(".main-content");
    if (main instanceof HTMLElement) {
        main.scrollTop = 0;
    }
    document.querySelectorAll("[data-page-scroll]").forEach((node) => {
        if (node instanceof HTMLElement) {
            node.scrollTop = 0;
        }
    });
}

const NavBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { isLoggedIn, loading, user, logout } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);

    useLayoutEffect(() => {
        resetWindowScroll();
        const frame = window.requestAnimationFrame(resetWindowScroll);
        const timer = window.setTimeout(resetWindowScroll, 50);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [pathname]);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!menuOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [menuOpen]);

    const handleLogout = async () => {
        await logout();
        router.push("/");
        router.refresh();
    };
    if (pathname === "/") {
        return <div className={styles.homeSpacer} aria-hidden="true" />;
    }

    return (
        <header className={styles.navbarShell}>
            {menuOpen && (
                <button
                    type="button"
                    className={styles.menuBackdrop}
                    aria-label="Close navigation"
                    onClick={() => setMenuOpen(false)}
                />
            )}
            <div className={styles.navbar}>
                <Title />
                <button
                    type="button"
                    className={`${styles.menuToggle} ${
                        menuOpen ? styles.menuToggleOpen : ""
                    }`}
                    aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={menuOpen}
                    aria-controls="main-navigation"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </div>
            <NavigationMenu
                isLoggedIn={isLoggedIn}
                sessionLoading={loading}
                isAdmin={Boolean(user?.isAdmin)}
                handleLogout={handleLogout}
                pathname={pathname}
                isOpen={menuOpen}
                onNavigate={() => setMenuOpen(false)}
            />
        </header>
    );
};

export default NavBar;
