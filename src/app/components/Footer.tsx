import Link from "next/link";
import styles from "./styles/footer.module.scss";
import { DEVELOPER_EMAIL } from "../lib/contact";

const PRODUCT_LINKS = [
    { href: "/discover", label: "Research" },
    { href: "/savedpapers", label: "Library" },
] as const;

const COMPANY_LINKS = [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/pricing", label: "Pricing" },
] as const;

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className={styles.footer} data-app-footer>
            <div className={styles.top} data-app-footer-top>
                <div className={styles.brand}>
                    <img src="/brainlogo.svg" alt="" width={32} height={32} />
                    <div>
                        <p className={styles.name}>Expansive Mind</p>
                        <p className={styles.tagline}>
                            Every finding stays tied to its source.
                        </p>
                    </div>
                </div>
                <div className={styles.columns}>
                    <nav className={styles.links} aria-label="Product">
                        {PRODUCT_LINKS.map((link) => (
                            <Link key={link.href} href={link.href}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                    <nav className={styles.links} aria-label="Company">
                        {COMPANY_LINKS.map((link) => (
                            <Link key={link.href} href={link.href}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>
            <div className={styles.legal}>
                <p>© {currentYear} Expansive Mind. All rights reserved.</p>
                <a href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>
            </div>
        </footer>
    );
};

export default Footer;
