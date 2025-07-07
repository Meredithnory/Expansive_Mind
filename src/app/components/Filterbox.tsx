import React, { useState } from "react";
import Image from "next/image";
import styles from "./filterbox.module.scss";
import clsx from "clsx";
const Filterbox = () => {
    const [downArrow, setDownArrow] = useState(false);

    const handleArrow = () => {
        setDownArrow(!downArrow);
    };

    return (
        <div>
            <div className={styles.filterbox}>
                <div className={styles.filterby}>Filter by:</div>
                <button className={styles.button} onClick={handleArrow}>
                    <Image
                        src="rightarrowicon.svg"
                        alt="Drop down menu icon"
                        width={1000}
                        height={760}
                        className={clsx(styles.rightarrow, {
                            [styles.downArrow]: downArrow === true,
                        })}
                    />
                </button>
            </div>
            {downArrow && (
                <div className={styles.filterboxes}>
                    <div className={styles.datetext}>Publication Date</div>
                    <div className={styles.yeartext}>
                        <button></button> 1 year
                    </div>
                    <div className={styles.yeartext}>
                        <button></button> 5 years
                    </div>
                    <div className={styles.yeartext}>
                        <button></button> 10 years
                    </div>
                </div>
            )}
        </div>
    );
};

export default Filterbox;
