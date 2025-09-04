import React from "react";
import styles from "./navigationmenu.module.scss";
import Link from "next/link";

interface NavMenuProps {
    isLoggedIn: boolean;
    handleLogout: () => void;
}

const NavigationMenu = ({ isLoggedIn, handleLogout }: NavMenuProps) => {
    return (
        <div className={styles.menubar}>
            {isLoggedIn ? (
                <>
                    <Link href="/get-started" className={styles.link}>
                        <div>Search</div>
                    </Link>
                    <Link href="/savedpapers" className={styles.link}>
                        <div>My Papers</div>
                    </Link>
                    <Link href="/about" className={styles.link}>
                        <div>About</div>
                    </Link>
                    <div className={styles.link} onClick={handleLogout}>
                        Logout
                    </div>
                </>
            ) : (
                <>
                    <Link href="/about" className={styles.link}>
                        <div>About</div>
                    </Link>
                    <Link href="/login" className={styles.link}>
                        <div>Login</div>
                    </Link>
                    <Link href="/signup" className={styles.link}>
                        <div>Sign-up</div>
                    </Link>
                </>
            )}
        </div>
    );
};

export default NavigationMenu;
