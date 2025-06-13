import React from "react";
import styles from "./navigationmenu.module.scss";
import Link from "next/link";

const NavigationMenu = () => {
    return (
        <div className={styles.menubar}>
            <Link href="/" className={styles.link}>
                <div>Home</div>
            </Link>
            <Link href="/login" className={styles.link}>
                <div>Login</div>
            </Link>
            <Link href="/signup" className={styles.link}>
                <div>Sign-up</div>
            </Link>
        </div>
    );
};

export default NavigationMenu;
