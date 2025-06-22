"use client";
import HamburgerIcon from "@/app/components/HamburgerIcon";
import Title from "@/app/components/Title";
import React, { useEffect } from "react";
import styles from "./paperchatbot.module.scss";
import Image from "next/image";
import Chatbox from "@/app/components/paperchatbot/Chatbox";
import Paperbox from "@/app/components/paperchatbot/Paperbox";
import { useRouter } from "next/navigation";
const page = ({ params }: { params: any }) => {
    const router = useRouter();
    const { pmid }: { pmid: string } = React.use(params);

    const fetchPaperInfo = async (paperPMIDToFetch: string) => {
        try {
            const params = new URLSearchParams();
            params.append("pmid", paperPMIDToFetch);
            const res = await fetch(`/api/paper?${params}`, {
                method: "GET",
            });
            const data = await res.json();
            console.log(data);
        } catch (err: any) {
            console.error("Frontend fetch error:", err);
        }
    };
    //Must refetch paper details if pmid changes using the array dependency in useEffect
    useEffect(() => {
        fetchPaperInfo(pmid);
    }, [pmid]);

    return (
        <div className={styles.page}>
            <div className={styles.navbarbox}>
                <Title />
                <HamburgerIcon />
            </div>
            <div className={styles.toolsbox}>
                <div className={styles.searcharea}>
                    <button
                        className={styles.searchbutton}
                        onClick={() => router.back()}
                    >
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
