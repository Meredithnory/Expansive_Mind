import React from "react";
import styles from "./title.module.scss";
import Link from "next/link";
const Title = () => {
    return (
        <Link href="/">
            <h1 className={styles.title}>Expansive Mind</h1>
        </Link>
    );
};

export default Title;
