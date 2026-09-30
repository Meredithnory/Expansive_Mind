"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useSession } from "../lib/use-session";
import styles from "./admin-portal.module.scss";

type NavItem = { href: string; label: string; icon: ReactNode };

const icon = (path: ReactNode) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {path}
    </svg>
);

const NAV: NavItem[] = [
    {
        href: "/admin",
        label: "Product pulse",
        icon: icon(<path d="M3 12h4l3-8 4 16 3-8h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />),
    },
    {
        href: "/admin/people",
        label: "People & support",
        icon: icon(
            <>
                <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
                <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>,
        ),
    },
    {
        href: "/admin/email",
        label: "Email",
        icon: icon(
            <>
                <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </>,
        ),
    },
    {
        href: "/admin/feedback",
        label: "Feedback inbox",
        icon: icon(
            <>
                <path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M4 13h4.5l1 2h5l1-2H20" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </>,
        ),
    },
    {
        href: "/admin/usage",
        label: "Usage & cost",
        icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />),
    },
    {
        href: "/admin/billing",
        label: "Billing & pricing",
        icon: icon(
            <>
                <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>,
        ),
    },
    {
        href: "/admin/reports",
        label: "Forum reports",
        icon: icon(<path d="M5 21V4m0 0h11l-2 4 2 4H5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />),
    },
    {
        href: "/admin/audit",
        label: "Audit log",
        icon: icon(
            <>
                <path d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>,
        ),
    },
];

function isActive(pathname: string, href: string) {
    return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function Brand() {
    return (
        <Link href="/admin" className={styles.brand}>
            <Image src="/brainlogo.svg" alt="Expansive Mind logo" width={40} height={40} />
            <span className={styles.brandText}>
                <span>Expansive Mind</span>
                <span className={styles.brandTag}>Admin</span>
            </span>
        </Link>
    );
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
    return (
        <ul className={styles.navList}>
            {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                    <li key={item.href}>
                        <Link
                            href={item.href}
                            className={clsx(styles.navLink, { [styles.navLinkActive]: active })}
                            aria-current={active ? "page" : undefined}
                            onClick={onNavigate}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {item.label}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}

/** The admin portal's frame: a sidebar on desktop, a bottom bar and menu on phones. */
export default function AdminShell({ children }: { children: ReactNode }) {
    const pathname = usePathname() || "/admin";
    const { user } = useSession();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => setMenuOpen(false), [pathname]);
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const logOut = async () => {
        await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
        window.location.assign("/admin/login");
    };

    const account = (
        <div className={styles.account}>
            <span className={styles.accountEmail}>{user?.email ?? ""}</span>
            <div className={styles.accountLinks}>
                <Link href="/discover">Back to the site</Link>
                <button type="button" onClick={logOut}>
                    Log out of admin
                </button>
            </div>
        </div>
    );

    return (
        <div className={styles.shell} data-admin-portal>
            <aside className={styles.sidebar} aria-label="Admin">
                <Brand />
                <nav aria-label="Admin pages">
                    <NavLinks pathname={pathname} />
                </nav>
                {account}
            </aside>

            <div className={styles.content}>{children}</div>

            <div className={styles.phoneBar}>
                <Brand />
                <button
                    type="button"
                    className={styles.menuButton}
                    aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
                    aria-expanded={menuOpen}
                    aria-controls="admin-menu"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        {menuOpen ? (
                            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        ) : (
                            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        )}
                    </svg>
                </button>
            </div>
            {menuOpen ? (
                <>
                    <button
                        type="button"
                        className={styles.menuBackdrop}
                        aria-label="Close admin menu"
                        onClick={() => setMenuOpen(false)}
                    />
                    <nav id="admin-menu" className={styles.phoneMenu} aria-label="Admin pages">
                        <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
                        {account}
                    </nav>
                </>
            ) : null}
        </div>
    );
}
