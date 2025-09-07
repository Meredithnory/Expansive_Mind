import React from "react";
import styles from "./about.module.scss";
import clsx from "clsx";
import Image from "next/image";
import PlaceholderLine from "../components/PlaceholderLine";

const page = () => {
    return (
        <>
            <div className={styles.wholebox}>
                <div className={styles.title}>How Expansive Mind Works</div>
                <div className={styles.boxesarea}>
                    <div className={clsx(styles.box1, styles.layout)}>
                        <div className={styles.boxtitle}>
                            <div className={styles.circle}>1</div>
                            Search
                        </div>
                        <div className={styles.text}>
                            Find research papers, articles, and studies
                            instantly.
                        </div>
                        <div className={styles.searcharea}>
                            Search
                            <div className={styles.searchbar}></div>
                        </div>
                        <div className={styles.searchbox1}>
                            <div className={styles.searchtitle1}>
                                <Image
                                    src="pinksearchicon.svg"
                                    alt="pink search icon"
                                    width={30}
                                    height={30}
                                    className={styles.searchicon}
                                />
                                Search
                            </div>
                            <PlaceholderLine width="90" />
                            <PlaceholderLine width="80" />
                            <PlaceholderLine width="60" />
                        </div>
                    </div>
                    <div className={clsx(styles.box2, styles.layout)}>
                        <div className={styles.boxtitle}>
                            <div className={styles.circle}>2</div>
                            Choose
                        </div>
                        <div className={styles.text2}>
                            Pick the most relevant source for your needs.
                        </div>
                        <div className={styles.searcharea2}>
                            <div className={styles.title2}>
                                Introduction to stem cells
                            </div>
                            <div className={styles.subtitle}>
                                Introduction to stem cells
                            </div>
                            <div className={styles.linebox1}>
                                <PlaceholderLine width="90" />
                                <PlaceholderLine width="75" />
                                <PlaceholderLine width="85" />
                            </div>
                            <div className={styles.linebox2}>
                                <PlaceholderLine width="100" />
                            </div>
                            <div className={styles.linebox3}>
                                <PlaceholderLine width="90" />
                                <PlaceholderLine width="75" />
                                <PlaceholderLine width="85" />
                            </div>
                        </div>
                    </div>
                    <div className={clsx(styles.box3, styles.layout)}>
                        <div className={styles.boxtitle}>
                            <div className={styles.circle}>3</div>
                            Chat
                        </div>
                        <div className={styles.searchbox3}>
                            <div className={styles.text2}>
                                Ask questions and get instant explanations.
                            </div>
                            <div className={styles.bottombox}>
                                <div className={styles.questionbox}>
                                    What are stem cells?
                                </div>
                                <div className={styles.responsebox}>
                                    <PlaceholderLine width="90" />
                                    <PlaceholderLine width="70" />
                                    <PlaceholderLine width="90" />
                                    <PlaceholderLine width="70" />
                                </div>
                                <div className={styles.inputbox}>
                                    <div className={styles.input}></div>
                                    <Image
                                        src="/uparrowicon.svg"
                                        alt="up arrow submit button"
                                        className={styles.image}
                                        width={33}
                                        height={21}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default page;
