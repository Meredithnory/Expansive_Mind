import React from "react";
import styles from "./chatbox.module.scss";
import Image from "next/image";

const Messages = () => {
    return <div className={styles.messages}>Messages</div>;
};

const Input = () => {
    const handleInput = (evt: any) => {
        const element = evt.target;
        element.style.height = "5px";
        element.style.height = element.scrollHeight + "px";
    };
    return (
        <div className={styles.chatinput}>
            <textarea
                onInput={handleInput}
                id="messageInput"
                placeholder="Type your message..."
            ></textarea>
            <button>
                <Image
                    src="/uparrowicon.svg"
                    alt="up arrow submit button"
                    width={33}
                    height={21}
                />
            </button>
        </div>
    );
};

const Chatbox = () => {
    return (
        <div className={styles.chatpaperbox}>
            <Messages />
            <Input />
        </div>
    );
};

export default Chatbox;
