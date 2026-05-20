import React, { SetStateAction } from "react";
import styles from "./styles/searchbar.module.scss";
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
    const handleKeyPress = (
        event: React.KeyboardEvent<HTMLInputElement>,
    ): void => {
        if (event.key === "Enter") {
            handleSubmit();
        }
    };

    return (
        <div className={clsx(styles.searchbox, className)}>
            <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Search papers"
                aria-label="Search papers"
            />
            <div className={styles.vertline} />
            <button onClick={handleSubmit} className={styles.button}>
                <img src="pinksearchicon.svg" alt="Search" />
            </button>
        </div>
    );
};

export default SearchBar;
