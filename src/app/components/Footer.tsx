import React from "react";
import Link from "next/link";
import styles from "./styles/footer.module.scss";
import { SITE_STATUS } from "./site-status";
import { DEVELOPER_EMAIL } from "../lib/contact";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className={styles.footer}>
            <span>
                © {currentYear} Expansive Mind · {SITE_STATUS.label}. All rights reserved.
                Unauthorized use is prohibited.
            </span>
            <nav className={styles.links} aria-label="Footer">
                <Link href="/about">About</Link>
                <Link href="/contact">Contact</Link>
                <a href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>
            </nav>
        </div>
    );
};
export default Footer;
