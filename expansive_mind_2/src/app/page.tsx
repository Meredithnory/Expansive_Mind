"use client";
import styles from "./home.module.scss";
import Link from "next/link";
import Title from "./components/Title";
export default function Home() {
    return (
        <div className={styles.home}>
            <div className={styles.box}>
                <h1>Expansive Mind</h1>
                <div className={styles.buttons}>
                    <Link href="/get-started">
                        <button>Get Started</button>
                    </Link>
                    <Link href="/login">
                        <button>Log-in</button>
                    </Link>
                </div>
            </div>
            <video src={"dnabg.mov"} autoPlay muted loop />
        </div>
    );
}
