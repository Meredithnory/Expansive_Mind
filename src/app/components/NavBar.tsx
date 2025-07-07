import React from "react";
import styles from "./navbar.module.scss";
import Title from "./Title";
import HamburgerIcon from "./HamburgerIcon";

const NavBar = () => {
    return (
        <div className={styles.navbar}>
            <Title />
            <HamburgerIcon />
        </div>
    );
};

export default NavBar;
