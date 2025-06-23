import React, { useEffect } from "react";
import styles from "./paperbox.module.scss";
import clsx from "clsx";
import {
    FormattedPaper,
    Section as SectionInterface,
    SubSection as SubSectionInterface,
} from "@/app/api/general-interfaces";
import Image from "next/image";

interface PaperBoxProps {
    paper: FormattedPaper | null;
    searchTerm: string | null;
}

const SubSection = ({ subSection }: { subSection: SubSectionInterface }) => {
    return (
        <>
            {subSection && (
                <div className={styles.subsection}>
                    {subSection.title && <h6>{subSection.title}</h6>}
                    {subSection.content && <p>{subSection.content}</p>}
                    {subSection.graphicSrc && (
                        <div className={styles.graphicSection}>
                            {subSection.graphicTitle && (
                                <span className={styles.graphicTitle}>
                                    {subSection.graphicTitle}
                                </span>
                            )}
                            <Image
                                src={subSection.graphicSrc}
                                alt={subSection.title}
                                layout="fill"
                                objectFit="contain"
                            />
                            {subSection.graphicContent && (
                                <p>{subSection.graphicContent}</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

const Section = ({ section }: { section: SectionInterface }) => {
    return (
        <div className={styles.section}>
            <h4>{section.title}</h4>
            <p>{section.content}</p>
            <div className={styles.subSectionWrap}>
                {section.subSections.map((subSection) => (
                    <SubSection
                        subSection={subSection}
                        key={subSection.title}
                    />
                ))}
            </div>
        </div>
    );
};

const Paperbox = ({ paper, searchTerm }: PaperBoxProps) => {
    if (!paper) {
        return null;
    }

    return (
        <div className={styles.paperbox}>
            <h1 className={clsx(styles.title, styles.text)}>
                {searchTerm &&
                paper.title?.toLowerCase().includes(searchTerm.toLowerCase())
                    ? paper.title
                          .split(new RegExp(`(${searchTerm})`, "gi"))
                          .map((part, index) =>
                              part.toLowerCase() ===
                              searchTerm.toLowerCase() ? (
                                  <span key={index} className={styles.bluetext}>
                                      {part}
                                  </span>
                              ) : (
                                  part
                              )
                          )
                    : paper.title}
            </h1>
            <div className={styles.authors}>{paper.authors.join(", ")}</div>
            <div className={styles.pmcid}>PMCID: PMC{paper.pmcid}</div>
            <div className={styles.paper}>
                {paper.paper.map((section) => (
                    <Section section={section} key={section.title} />
                ))}
            </div>
        </div>
    );
};

export default Paperbox;
