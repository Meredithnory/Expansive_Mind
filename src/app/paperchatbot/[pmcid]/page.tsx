"use client";
import React, { useEffect, useState } from "react";
import styles from "./paperchatbot.module.scss";
import Image from "next/image";
import Chatbox from "../../components/paperchatbot/Chatbox";
import Paperbox from "../../components/paperchatbot/Paperbox";
import { useRouter, useSearchParams } from "next/navigation";
import { FormattedPaper } from "../../api/general-interfaces";
import Loading from "../../components/Loading";
import NavBar from "../../components/NavBar";

const LeftArrowSVG = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="m0 13.453 11.986 12.7 2.731-2.893-9.255-9.807 9.255-9.807-2.73-2.894L0 13.452Zm10.91 0 11.986 12.7 2.731-2.893-9.255-9.807 9.255-9.807-2.73-2.894-11.987 12.7Z" />
    </svg>
);

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
    const [highlight, setHighlight] = useState(false);
    const [highlightedText, setHighlightedText] = useState("");
    const [allMessages, setAllMessages] = useState([
        {
            id: Date.now(),
            sender: "ai",
            message:
                "Hello! How are you today? When you've had the chance to look over the paper, is there a particular section or finding you're curious about? I'm here to help with any questions you might have!",
            timestamp: new Date(),
            animate: true,
        },
    ]);

    const fetchPaperInfo = async (paperPMCIDToFetch: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append("pmcid", paperPMCIDToFetch);
            const res = await fetch(`/api/paper?${params}`, {
                method: "GET",
            });
            const data = await res.json();
            setResearchPaper(data.paper);
            setAllMessages((prevMessages) => [
                ...prevMessages,
                ...data.messages,
            ]);
        } catch (err: any) {
            console.error("Frontend fetch error:", err);
        }
        setLoading(false);
    };
    //Must refetch paper details if pmcid changes using the array dependency in useEffect
    useEffect(() => {
        fetchPaperInfo(pmcid);
    }, [pmcid]);

    //Handle highlight
    const handleHighlight = () => {
        setHighlight(!highlight);
    };

    const handleHighlightedText = () => {
        const text = window.getSelection()?.toString();

        if (!text) {
            return;
        } else {
            setHighlightedText(text);
        }
    };
    if (loading) {
        return (
            <div className="full-height-loading">
                <Loading />
            </div>
        );
    }
    return (
        <div className={styles.page}>
            <div className={styles.toolsbox}>
                <div className={styles.searcharea}>
                    <button
                        className={styles.searchbutton}
                        onClick={() => router.back()}
                    >
                        <LeftArrowSVG />
                        <div className={styles.text}>Back to Search</div>
                    </button>
                </div>
                {/* <button
                    className={clsx(styles.highlightbutton, {
                        [styles.activeHighlighter]: highlight === true,
                    })}
                    onClick={handleHighlight}
                >
                    <div className={clsx(styles.highlight)}>Chat-tool:</div>
                    <Image
                        className={styles.icon}
                        width={1000}
                        height={760}
                        src="/highlighticon.svg"
                        alt="highlighter icon"
                    />
                </button> */}
            </div>
            <div className={styles.paperchatcontainer}>
                <Chatbox
                    wholePaper={researchPaper}
                    highlightedText={highlightedText}
                    allMessages={allMessages}
                    setAllMessages={setAllMessages}
                />
                <Paperbox
                    paper={researchPaper}
                    searchTerm={qParam}
                    highlight={highlight}
                    handleHighlightedText={handleHighlightedText}
                />
            </div>
        </div>
    );
};

export default page;
