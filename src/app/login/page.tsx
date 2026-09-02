"use client";
import React, { useState } from "react";
import styles from "./login.module.scss";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Loading from "../components/Loading";
import { useSession } from "../lib/use-session";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const { refresh } = useSession();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await refresh();
                router.push("/discover");
                router.refresh();
            } else {
                //Login failed
                setError(data.message || "Login failed");
            }
        } catch (error) {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className={styles.page}>
                <div className={styles.loginBox}>
                    <div className={styles.loginContainer}>
                        <div className={styles.loginText}>Login</div>

                        {/* Show error message if exists */}
                        {error && <div className={styles.error}>{error}</div>}
                        <form
                            className={styles.maincontent}
                            onSubmit={handleLogin}
                        >
                            <div className={styles.email}>
                                Email
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="emailicon.svg"
                                        alt="Email icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="email"
                                        name="email"
                                        placeholder="Type your email"
                                        value={email}
                                        onChange={(e) =>
                                            setEmail(e.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <div className={styles.password}>
                                Password
                                <div className={styles.inputwrapper}>
                                    <Image
                                        src="lockicon.svg"
                                        alt="Lock icon"
                                        width={24}
                                        height={24}
                                        className={styles.icon}
                                    />
                                    <input
                                        type="password"
                                        name="password"
                                        placeholder="Type your password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className={styles.loginButton}
                                disabled={loading}
                                style={{
                                    opacity: loading ? 0.6 : 1,
                                    cursor: loading
                                        ? "not-allowed"
                                        : "pointer",
                                }}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </button>
                            <p className={styles.signupPrompt}>
                                Don&apos;t have an account?{" "}
                                <Link href="/signup">Sign up</Link>
                            </p>
                        </form>
                        {loading && (
                            <div className={styles.loader}>
                                <Loading />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default LoginPage;
