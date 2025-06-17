import React, { SetStateAction } from "react";
import styles from "./searchbar.module.scss";
import clsx from "clsx";

interface SearchProps {
    searchValue: string;
    setSearchValue: React.Dispatch<SetStateAction<string>>;
    handleSubmit: () => void;
    className?: string;
}

const SearchBar = ({
    searchValue,
    setSearchValue,
    handleSubmit,
    className,
}: SearchProps) => {
    return (
        <div className={clsx(styles.searchbox, className)}>
            <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
            />
            <div className={styles.vertline} />
            <button onClick={handleSubmit} className={styles.button}>
                <img src="searchicon.svg" />
            </button>
        </div>
    );
};

export default SearchBar;
