"use client";
import React, { FormEvent, useState } from "react";
import styles from "./signuppage.module.scss";
import HamburgerIcon from "../components/HamburgerIcon";
import Title from "../components/Title";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import clsx from "clsx";

const page = () => {
    const [message, setMessage] = useState("");
    const router = useRouter();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = event.currentTarget;
        const formData = new FormData(event.currentTarget);
        try {
            const response = await fetch("/api/submit", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.success) {
                //Clear the form
                form.reset();
                //Set message to Succesfull
                setMessage("Sign up succesful! Redirecting to login...");
                //Add delay
                setTimeout(() => {
                    //Redirect to login page
                    router.push("/login");
                }, 3500);
            } else {
                setMessage("Email already registered!");
            }
            console.log("Response status:", response.status);
            console.log("Full response data:", data);
        } catch (error) {
            console.error("Error:", error);
        }
    }

    interface Pages {
        title: string;
        authors: string;
        description: string;
        id: number;
    }

    const pages: Pages[] = [
        {
            title: "Introduction to stem cells",
            authors: "Tian Z, Yu T, Liu J, Wang T, Higuchi A. ",
            description:
                "This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem... ",
            id: 1,
        },
        {
            title: "Artificial Intelligence-Assisted Emergency Department Vertical Patient Flow Optimization",
            authors:
                "Nicole R. Hodgson, Soroush Saghafian, Wayne A. Martini, Arshya Feizi, Agni Orfanoudaki",
            description:
                "Recent advances in artificial intelligence (AI) and machine learning (ML) enable targeted optimization of emergency department (ED) operations. We examine how reworking an ED's vertical processing pathway (VPP) using AI- and ML-driven recommendations affected patient throughput...",
            id: 2,
        },
        {
            title: "Cost efficiency versus energy utilization in green ammonia production from intermittent renewable energy",
            authors: "Collin Smith, Laura Torrente-Murciano ",
            description:
                "Electrification of the chemical industry with renewable energy is critical for achieving net zero goals and the long-term storage of renewable energy in chemical bonds, particularly carbon-free molecules such as ammonia...",
            id: 3,
        },
    ];

    return (
        <>
            <div className={styles.navbar}>
                <Title />
                <HamburgerIcon />
            </div>
            <div className={styles.signuparea}>
                <div className={styles.left}>
                    <div className={styles.box}>
                        <div className={styles.signuptext}>
                            Sign up
                            <div className={styles.continuetext}>
                                Sign up to continue
                            </div>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.email}>
                                Email:
                                <input
                                    type="text"
                                    name="email"
                                    placeholder="youremail@here.com"
                                    required
                                />
                            </div>
                            <div className={styles.name}>
                                <div className={styles.namebox}>
                                    First name:
                                    <input
                                        type="text"
                                        name="first_name"
                                        placeholder="First name"
                                        required
                                    />
                                </div>

                                <div className={styles.last}>
                                    <div className={styles.lastbox}>
                                        Last name:
                                        <input
                                            type="text"
                                            name="last_name"
                                            placeholder="Last name"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className={styles.password}>
                                Password:
                                <input
                                    type="text"
                                    name="password"
                                    placeholder="Password"
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className={styles.submitbutton}>
                                <button type="submit">Sign up</button>
                            </div>
                            <div className={styles.signtext}>
                                Already have an account?{" "}
                                <Link href="/login">Sign in</Link>
                            </div>
                        </form>
                        {message && (
                            <div
                                className={clsx(styles.message, {
                                    [styles.errorMessage]:
                                        message.includes("already"),
                                    [styles.successMessage]:
                                        message.includes("succesful"),
                                })}
                            >
                                {message}
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.right}>
                    <div className={styles.toptext}>
                        All papers under one page.
                    </div>
                    <div className={styles.paperbox}></div>
                    <div className={styles.chatdeletebox}>
                        {pages.map((page) => (
                            <div key={page.id} className={styles.entirepage}>
                                <div className={styles.page}>
                                    <div className={styles.title}>
                                        {page.title}
                                    </div>
                                    <div className={styles.authors}>
                                        {page.authors}
                                    </div>
                                    <div className={styles.description}>
                                        {page.description}
                                    </div>
                                </div>
                                <div className={styles.icons}>
                                    <div className={styles.chaticon}>
                                        <Image
                                            className={styles.icon}
                                            src="/chaticon.svg"
                                            alt="Chaticon"
                                            width={16}
                                            height={16}
                                        />
                                        Chat
                                    </div>
                                    <div className={styles.trashicon}>
                                        <Image
                                            className={styles.icon}
                                            src="/trashicon.svg"
                                            alt="Trashicon"
                                            width={16}
                                            height={16}
                                        />
                                        Delete
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default page;
