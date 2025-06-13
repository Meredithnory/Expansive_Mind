import React, { SetStateAction } from "react";
import styles from "./searchbar.module.scss";

interface SearchProps {
    searchValue: string;
    setSearchValue: React.Dispatch<SetStateAction<string>>;
    handleSubmit: () => void;
}

const SearchBar = ({
    searchValue,
    setSearchValue,
    handleSubmit,
}: SearchProps) => {
    return (
        <div className={styles.searchbox}>
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
