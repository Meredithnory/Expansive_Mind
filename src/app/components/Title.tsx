import React from "react";
import styles from "./styles/title.module.scss";
import Link from "next/link";
import Image from "next/image";

const Title = () => {
    return (
        <Link href="/" className={styles.link}>
            <Image
                src="/brainlogo.svg"
                alt="brainlogo"
                width={50}
                height={50}
                className={styles.image}
            />
            <h1 className={styles.title}>Expansive Mind</h1>
        </Link>
    );
};

export default Title;
