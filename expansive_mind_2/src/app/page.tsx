"use client";
import styles from "./home.module.scss";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCookies } from "next-client-cookies";
import { useRouter } from "next/navigation";

export default function Home() {
    const cookies = useCookies();
    const router = useRouter();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = cookies.get("auth_token");
        setIsLoggedIn(!!token);
    }, []);

    const handleLogout = () => {
        cookies.remove("auth_token");
        window.location.reload();
    };

    return (
        <div className={styles.home}>
            <div className={styles.box}>
                <h1>Expansive Mind</h1>
                <div className={styles.buttons}>
                    <Link href="/get-started">
                        <button>Get Started</button>
                    </Link>
                    {isLoggedIn ? (
                        <button onClick={handleLogout}>Logout</button>
                    ) : (
                        <Link href="/signup">
                            <button>Sign-up</button>
                        </Link>
                    )}
                </div>
            </div>
            <video src={"dnabg.mov"} autoPlay muted loop />
        </div>
    );
}
