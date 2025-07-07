import React from "react";
import styles from "../components/searchresults.module.scss";
import clsx from "clsx";
import Link from "next/link";

interface SearchResult {
    pmcid: string;
    title: string;
    authors: string[];
    date: string;
    abstract: string;
}
interface searchResultsProps {
    searchResults: SearchResult[];
    searchValue: string;
}

const SearchResults = ({ searchResults, searchValue }: searchResultsProps) => {
    const params = new URLSearchParams();
    params.append("q", searchValue);
    return (
        <div className={styles.paperwrap}>
            {searchResults.map((paper) => (
                <div className={styles.paper} key={paper.pmcid}>
                    <div className={clsx(styles.publicationdate, styles.text)}>
                        {paper.date}
                    </div>
                    <Link
                        href={`/paperchatbot/${paper.pmcid}?${params}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                    >
                        <div className={clsx(styles.title, styles.text)}>
                            {searchValue &&
                            paper.title
                                ?.toLowerCase()
                                .includes(searchValue.toLowerCase())
                                ? paper.title
                                      .split(
                                          new RegExp(`(${searchValue})`, "gi")
                                      )
                                      .map((part, index) =>
                                          part.toLowerCase() ===
                                          searchValue.toLowerCase() ? (
                                              <span
                                                  key={index}
                                                  className={styles.bluetext}
                                              >
                                                  {part}
                                              </span>
                                          ) : (
                                              part
                                          )
                                      )
                                : paper.title}
                        </div>
                    </Link>
                    <div className={clsx(styles.author, styles.text)}>
                        {paper.authors.join(", ")}
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
