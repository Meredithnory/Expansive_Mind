"use client";
import HamburgerIcon from "@/app/components/HamburgerIcon";
import Title from "@/app/components/Title";
import React, { useEffect } from "react";
import styles from "./paperchatbot.module.scss";
import Image from "next/image";
import Chatbox from "@/app/components/paperchatbot/Chatbox";
import Paperbox from "@/app/components/paperchatbot/Paperbox";
const page = ({ params }: { params: any }) => {
    const { isbn }: { isbn: string } = React.use(params);
    useEffect(() => {
        console.log(isbn);
    }, []);
    return (
        <div className={styles.page}>
            <div className={styles.navbarbox}>
                <Title />
                <HamburgerIcon />
            </div>
            <div className={styles.toolsbox}>
                <div className={styles.searcharea}>
                    <button className={styles.searchbutton}>
                        <Image
                            className={styles.icon}
                            width={1000}
                            height={760}
                            src="/leftarrowicon.svg"
                            alt="leftarrowicon.svg"
                        />
                        <div className={styles.text}>Back to Search</div>
                    </button>
                </div>
                <button className={styles.highlightbutton}>
                    <div className={styles.highlight}>Chat-tool:</div>
                    <Image
                        className={styles.icon}
                        width={1000}
                        height={760}
                        src="/highlighticon.svg"
                        alt="highlighter icon"
                    />
                </button>
            </div>
            <div className={styles.paperchatcontainer}>
                <Chatbox />
                <Paperbox />
            </div>
        </div>
    );
};

export default page;
