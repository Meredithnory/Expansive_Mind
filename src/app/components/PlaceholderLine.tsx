import React from "react";
import styles from "../about/about.module.scss";

const PlaceholderLine = ({ width }: { width: string }) => {
    return <div style={{ width: `${width}%` }} className={styles.line} />;
};

export default PlaceholderLine;
