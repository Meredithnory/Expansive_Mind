import React from "react";
import styles from "./styles/navigationmenu.module.scss";
import Link from "next/link";

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

    return (
        <nav
            id="main-navigation"
            className={`${styles.menubar} ${isOpen ? styles.open : ""}`}
            aria-label="Main navigation"
        >
            {isLoggedIn ? (
                <>
                    <Link
                        href="/discover"
                        className={linkClass("/discover")}
                        onClick={onNavigate}
                    >
                        Discover
                    </Link>
                    <Link
                        href="/searchpaper"
                        className={linkClass("/searchpaper")}
                        onClick={onNavigate}
                    >
                        Search
                    </Link>
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
                    <Link
                        href="/discover"
                        className={linkClass("/discover")}
                        onClick={onNavigate}
                    >
                        Discover
                    </Link>
                    <Link
                        href="/searchpaper"
                        className={linkClass("/searchpaper")}
                        onClick={onNavigate}
                    >
                        Search
                    </Link>
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
