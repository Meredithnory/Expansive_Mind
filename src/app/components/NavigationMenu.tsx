import React from "react";
import styles from "./styles/navigationmenu.module.scss";
import Link from "next/link";
import { RESEARCH_PATH } from "../lib/research-mode";

interface NavMenuProps {
    isLoggedIn: boolean;
    sessionLoading: boolean;
    isAdmin: boolean;
    handleLogout: () => void;
    pathname: string;
    isOpen: boolean;
    onNavigate: () => void;
}

const isActive = (pathname: string, href: string) => {
    if (href === "/savedpapers") {
        return (
            pathname === "/savedpapers" ||
            pathname.startsWith("/projects")
        );
    }

    if (href === RESEARCH_PATH) {
        return (
            pathname === RESEARCH_PATH ||
            pathname.startsWith(`${RESEARCH_PATH}/`) ||
            pathname === "/searchpaper" ||
            pathname.startsWith("/searchpaper/")
        );
    }

    return pathname === href || pathname.startsWith(`${href}/`);
};

const NavigationMenu = ({
    isLoggedIn,
    sessionLoading,
    isAdmin,
    handleLogout,
    pathname,
    isOpen,
    onNavigate,
}: NavMenuProps) => {
    const linkClass = (href: string) =>
        `${styles.link} ${isActive(pathname, href) ? styles.active : ""}`;

    const researchLink = (
        <Link
            href={RESEARCH_PATH}
            className={linkClass(RESEARCH_PATH)}
            onClick={onNavigate}
        >
            Research
        </Link>
    );

    return (
        <nav
            id="main-navigation"
            className={`${styles.menubar} ${isOpen ? styles.open : ""}`}
            aria-label="Main navigation"
        >
            {isLoggedIn ? (
                <>
                    {researchLink}
                    <Link
                        href="/savedpapers"
                        className={linkClass("/savedpapers")}
                        onClick={onNavigate}
                    >
                        Library
                    </Link>
                    {isAdmin && (
                        <Link
                            href="/admin"
                            className={linkClass("/admin")}
                            onClick={onNavigate}
                        >
                            Admin
                        </Link>
                    )}
                    <Link
                        href="/about"
                        className={linkClass("/about")}
                        onClick={onNavigate}
                    >
                        About
                    </Link>
                    <Link
                        href="/contact"
                        className={linkClass("/contact")}
                        onClick={onNavigate}
                    >
                        Contact
                    </Link>
                    <Link
                        href="/pricing"
                        className={linkClass("/pricing")}
                        onClick={onNavigate}
                    >
                        Pricing
                    </Link>
                    <button
                        type="button"
                        className={`${styles.link} ${styles.logout}`}
                        onClick={() => {
                            onNavigate();
                            handleLogout();
                        }}
                    >
                        Logout
                    </button>
                </>
            ) : (
                <>
                    {researchLink}
                    <Link
                        href="/about"
                        className={linkClass("/about")}
                        onClick={onNavigate}
                    >
                        About
                    </Link>
                    <Link
                        href="/contact"
                        className={linkClass("/contact")}
                        onClick={onNavigate}
                    >
                        Contact
                    </Link>
                    <Link
                        href="/pricing"
                        className={linkClass("/pricing")}
                        onClick={onNavigate}
                    >
                        Pricing
                    </Link>
                    {!sessionLoading && (
                        <div className={styles.authActions}>
                            <Link
                                href="/login"
                                className={linkClass("/login")}
                                onClick={onNavigate}
                            >
                                Login
                            </Link>
                            <Link
                                href="/signup"
                                className={`${styles.link} ${styles.signupLink} ${
                                    isActive(pathname, "/signup")
                                        ? styles.active
                                        : ""
                                }`}
                                onClick={onNavigate}
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </>
            )}
        </nav>
    );
};

export default NavigationMenu;
