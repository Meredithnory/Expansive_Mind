import React, { useEffect, useRef, useState } from "react";
import styles from "./styles/navigationmenu.module.scss";
import Link from "next/link";
import { RESEARCH_PATH } from "../lib/research-mode";
import ProfileMark from "./ProfileMark";

interface NavMenuProps {
    isLoggedIn: boolean;
    sessionLoading: boolean;
    isAdmin: boolean;
    profileColor?: string | null;
    badge?: import("../lib/lab-badge").Badge;
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
    profileColor,
    badge,
    handleLogout,
    pathname,
    isOpen,
    onNavigate,
}: NavMenuProps) => {
    const linkClass = (href: string) =>
        `${styles.link} ${isActive(pathname, href) ? styles.active : ""}`;

    // Mid-width screens tuck the less-used links under "More" so the
    // wordmark keeps its room. Wide screens and the phone sheet show them
    // inline (the group uses display: contents there).
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef<HTMLDivElement>(null);
    const closeMore = () => setMoreOpen(false);
    const navigate = () => {
        closeMore();
        onNavigate();
    };

    useEffect(() => {
        if (!moreOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!moreRef.current?.contains(event.target as Node)) closeMore();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") closeMore();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [moreOpen]);

    useEffect(() => {
        closeMore();
    }, [pathname]);

    const moreHrefs = [
        ...(isLoggedIn && isAdmin ? ["/admin"] : []),
        "/about",
        "/contact",
        "/pricing",
    ];
    const moreActive = moreHrefs.some((href) => isActive(pathname, href));

    const moreGroup = (items: React.ReactNode) => (
        <div ref={moreRef} className={styles.moreGroup}>
            <button
                type="button"
                className={`${styles.link} ${styles.moreButton} ${moreActive ? styles.active : ""}`}
                aria-expanded={moreOpen}
                aria-controls="nav-more-menu"
                onClick={() => setMoreOpen((open) => !open)}
            >
                More
                <span
                    className={`${styles.moreChevron} ${moreOpen ? styles.moreChevronOpen : ""}`}
                    aria-hidden="true"
                />
            </button>
            <div
                id="nav-more-menu"
                className={`${styles.moreMenu} ${moreOpen ? styles.moreMenuOpen : ""}`}
            >
                {items}
            </div>
        </div>
    );

    const researchLink = (
        <Link
            href={RESEARCH_PATH}
            className={linkClass(RESEARCH_PATH)}
            onClick={navigate}
        >
            Research
        </Link>
    );

    return (
        <nav
            id="main-navigation"
            className={`${styles.menubar} ${isLoggedIn ? styles.dense : ""} ${isOpen ? styles.open : ""}`}
            aria-label="Main navigation"
        >
            {isLoggedIn ? (
                <>
                    {researchLink}
                    <Link
                        href="/savedpapers"
                        className={linkClass("/savedpapers")}
                        onClick={navigate}
                    >
                        Library
                    </Link>
                    <Link
                        href="/forum"
                        className={linkClass("/forum")}
                        onClick={navigate}
                    >
                        Forum
                    </Link>
                    <Link
                        href="/groups"
                        className={`${linkClass("/groups")} ${styles.inlineOnly}`}
                        onClick={navigate}
                    >
                        Groups
                    </Link>
                    <Link
                        href="/profile"
                        className={`${linkClass("/profile")} ${styles.profileLink}`}
                        onClick={navigate}
                        aria-label="Profile"
                    >
                        <ProfileMark color={profileColor} badge={badge} size={24} />
                        <span className={styles.profileText}>Profile</span>
                    </Link>
                    {moreGroup(
                        <>
                            <Link
                                href="/groups"
                                className={`${linkClass("/groups")} ${styles.moreOnly}`}
                                onClick={navigate}
                            >
                                Groups
                            </Link>
                            {isAdmin && (
                                <Link
                                    href="/admin"
                                    className={linkClass("/admin")}
                                    onClick={navigate}
                                >
                                    Admin
                                </Link>
                            )}
                            <Link
                                href="/about"
                                className={linkClass("/about")}
                                onClick={navigate}
                            >
                                About
                            </Link>
                            <Link
                                href="/contact"
                                className={linkClass("/contact")}
                                onClick={navigate}
                            >
                                Contact
                            </Link>
                            <Link
                                href="/pricing"
                                className={linkClass("/pricing")}
                                onClick={navigate}
                            >
                                Pricing
                            </Link>
                            <button
                                type="button"
                                className={`${styles.link} ${styles.logout}`}
                                onClick={() => {
                                    navigate();
                                    handleLogout();
                                }}
                            >
                                Logout
                            </button>
                        </>,
                    )}
                </>
            ) : (
                <>
                    {researchLink}
                    <Link
                        href="/forum"
                        className={linkClass("/forum")}
                        onClick={navigate}
                    >
                        Forum
                    </Link>
                    {moreGroup(
                        <>
                            <Link
                                href="/about"
                                className={linkClass("/about")}
                                onClick={navigate}
                            >
                                About
                            </Link>
                            <Link
                                href="/contact"
                                className={linkClass("/contact")}
                                onClick={navigate}
                            >
                                Contact
                            </Link>
                            <Link
                                href="/pricing"
                                className={linkClass("/pricing")}
                                onClick={navigate}
                            >
                                Pricing
                            </Link>
                        </>,
                    )}
                    {!sessionLoading && (
                        <div className={styles.authActions}>
                            <Link
                                href="/login"
                                className={linkClass("/login")}
                                onClick={navigate}
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
                                onClick={navigate}
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
