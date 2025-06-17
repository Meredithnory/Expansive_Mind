import React from "react";
import styles from "../components/searchresults.module.scss";
import clsx from "clsx";
import Link from "next/link";

const SearchResults = () => {
    //Mock Data
    const searchResults = [
        {
            isbn: "npwfjepofq",
            title: " Introduction to stem cells.",
            author: "Tian Z, Yu T, Liu J, Wang T, Higuchi A.",
            publicationDate: "September 20, 2021",
            abstract:
                "This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem...",
        },
        {
            isbn: "npepofq",
            title: " Introduction to stem cells.",
            author: "Tian Z, Yu T, Liu J, Wang T, Higuchi A.",
            publicationDate: "September 20, 2021",
            abstract:
                "This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem...",
        },
        {
            isbn: "npwfdsdfdsq",
            title: " Introduction to stem cells.",
            author: "Tian Z, Yu T, Liu J, Wang T, Higuchi A.",
            publicationDate: "September 20, 2021",
            abstract:
                "This review discusses the history, definition, and classification of stem cells. Human pluripotent stem cells (hPSCs) mainly include embryonic stem cells (hESCs) and included pluripotent stem cells (hiPSCs). Embryonic stem...",
        },
    ];
    return (
        <div className={styles.paper}>
            {searchResults.map((paper) => (
                <div className={styles.paper} key={paper.isbn}>
                    <Link
                        href={`/paperchatbot/${paper.isbn}}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                    >
                        <div className={clsx(styles.title, styles.text)}>
                            {paper.title}
                        </div>
                    </Link>
                    <div className={clsx(styles.author, styles.text)}>
                        {paper.author}
                    </div>
                    <div className={clsx(styles.publicationdate, styles.text)}>
                        {paper.publicationDate}
                    </div>
                    <div className={clsx(styles.abstract, styles.text)}>
                        {paper.abstract}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SearchResults;
