import React from "react";
import styles from "./styles/footer.module.scss";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className={styles.footer}>
            <span>
                © {currentYear} Expansive Mind. All rights reserved.
                Unauthorized use is prohibited.
            </span>
        </div>
    );
};
export default Footer;
