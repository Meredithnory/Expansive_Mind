"use client";
import styles from "./home.module.scss";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCookies } from "next-client-cookies";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function Home() {
    const cookies = useCookies();
    const router = useRouter();

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const token = cookies.get("auth_token");

    useEffect(() => {
        setIsLoggedIn(!!token);
    }, [token]);

    const handleLogout = () => {
        cookies.remove("auth_token");
        router.push("/");
    };

    return (
        <div className={styles.home}>
            <div className={styles.box}>
                <div className={styles.title}>
                    <h1>Expansive Mind</h1>
                    <Image
                        src="/brainlogo.svg"
                        alt="icon logo"
                        width={70}
                        height={70}
                    />
                </div>
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
