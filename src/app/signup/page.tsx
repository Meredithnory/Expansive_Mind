"use client";
import React, { FormEvent, useState } from "react";
import styles from "./signuppage.module.scss";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import Loading from "../components/Loading";

const page = () => {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const router = useRouter();

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const form = event.currentTarget;
        const formData = new FormData(event.currentTarget);
        try {
            const response = await fetch("/api/signup", {
                method: "POST",
                body: formData,
            });
            const data = await response.json();

            if (data.success) {
                //Clear the form
                form.reset();
                //Set message to Succesfull
                setMessage("Sign up succesful! Redirecting to login...");
                //Immediately set loading to true
                setLoading(true);
                //Add delay
                setTimeout(() => {
                    //Redirect to login page
                    router.push("/login");
                    //Stop loading
                    setLoading(false);
                }, 3500);
            } else {
                setMessage("Email already registered!");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    }

    return (
        <>
            <div className={styles.signuparea}>
                <div className={styles.center}>
                    <div className={styles.box}>
                        <div className={styles.signuptext}>
                            Sign Up
                            <div
                                className={clsx(styles.continuetext, {
                                    [styles.errorMessage]:
                                        message.includes("already"),
                                    [styles.successMessage]:
                                        message.includes("succesful"),
                                })}
                            >
                                {message ||
                                    "Create your free account to get started."}
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
                                    type="password"
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

export default page;
