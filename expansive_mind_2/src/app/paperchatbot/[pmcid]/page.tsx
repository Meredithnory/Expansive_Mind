"use client";
import HamburgerIcon from "@/app/components/HamburgerIcon";
import Title from "@/app/components/Title";
import React, { useEffect, useState } from "react";
import styles from "./paperchatbot.module.scss";
import Image from "next/image";
import Chatbox from "@/app/components/paperchatbot/Chatbox";
import Paperbox from "@/app/components/paperchatbot/Paperbox";
import { useRouter, useSearchParams } from "next/navigation";
import { FormattedPaper } from "@/app/api/general-interfaces";
import Loading from "@/app/components/Loading";

const page = ({ params }: { params: any }) => {
    const router = useRouter();
    const { pmcid }: { pmcid: string } = React.use(params);
    //Get query params in the URL from the get-started page FIRST
    const searchParams = useSearchParams();
    const qParam = searchParams.get("q");

    const [researchPaper, setResearchPaper] = useState<FormattedPaper | null>(
        null
    );
    const [loading, setLoading] = useState(true);

    const fetchPaperInfo = async (paperPMCIDToFetch: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("pmcid", paperPMCIDToFetch);
            const res = await fetch(`/api/paper?${params}`, {
                method: "GET",
            });
            const data = await res.json();
            console.log(data);
            setResearchPaper(data.paper);
        } catch (err: any) {
            console.error("Frontend fetch error:", err);
        }
        setLoading(false);
    };
    //Must refetch paper details if pmcid changes using the array dependency in useEffect
    useEffect(() => {
        fetchPaperInfo(pmcid);
    }, [pmcid]);

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
            {loading ? (
                <div className={styles.loader}>
                    <Loading />
                </div>
            ) : (
                <div className={styles.paperchatcontainer}>
                    <Chatbox wholePaper={researchPaper} />
                    <Paperbox paper={researchPaper} searchTerm={qParam} />
                </div>
            )}
        </div>
    );
};

export default page;
