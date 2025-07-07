import React from "react";
import Image from "next/image";
import styles from "./savedpaper.module.scss";
import Link from "next/link";

export interface Paper {
    title: string;
    authors: string;
    description: string;
    id: string;
}
const SavedPaper = ({ page, isLink }: { page: Paper; isLink: boolean }) => {
    return (
        <div key={page.id} className={styles.entirepage}>
            <div className={styles.page}>
                <div className={styles.title}>{page.title}</div>
                <div className={styles.authors}>{page.authors}</div>
                <div className={styles.description}>{page.description}</div>
            </div>
            <div className={styles.icons}>
                {isLink ? (
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
                ) : (
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
                )}
                {/* <div className={styles.trashicon}>
                    <Image
                        className={styles.icon}
                        src="/trashicon.svg"
                        alt="Trashicon"
                        width={16}
                        height={16}
                    />
                    Delete
                </div> */}
            </div>
        </div>
    );
};

export default SavedPaper;
