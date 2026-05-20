import React from "react";
import Image from "next/image";
import styles from "./styles/savedpaper.module.scss";
import Link from "next/link";

export interface Paper {
    title: string;
    authors: string;
    description: string;
    id: string;
}

const SOURCE_LABEL = "NIH PubMed";

const SavedPaper = ({
    page,
    isLink,
    deletePaper,
}: {
    page: Paper;
    isLink: boolean;
    deletePaper: (id: string) => void;
}) => {
    //we have all papers but now we need to delete the papers find the key and delete
    function handleDelete() {
        deletePaper(page.id);
    }
    return (
        <>
            <div key={page.id} className={styles.entirepage}>
                <div className={styles.page}>
                    <div className={styles.sourceTag} aria-label={SOURCE_LABEL}>
                        <span className={styles.sourceDot} />
                        <span className={styles.sourceText}>
                            {SOURCE_LABEL}
                        </span>
                    </div>
                    <Link href={`/paperchatbot/${page.id}`}>
                        <div className={styles.title}>{page.title}</div>
                    </Link>
                    <div className={styles.authors}>{page.authors}</div>
                    <div className={styles.description}>{page.description}</div>
                </div>
                <div className={styles.icons}>
                    {isLink && (
                        <>
                            <Link href={`/paperchatbot/${page.id}`}>
                                <div className={styles.chaticon}>
                                    <Image
                                        className={styles.icon}
                                        src="/chaticon.svg"
                                        alt="Chaticon"
                                        width={100}
                                        height={100}
                                    />
                                    Chat
                                </div>
                            </Link>

                            <button
                                onClick={handleDelete}
                                className={styles.deletebutton}
                            >
                                <div className={styles.trashicon}>
                                    <Image
                                        className={styles.icon}
                                        src="/trashicon.svg"
                                        alt="Trashicon"
                                        width={30}
                                        height={30}
                                    />
                                    Delete
                                </div>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

export default SavedPaper;
