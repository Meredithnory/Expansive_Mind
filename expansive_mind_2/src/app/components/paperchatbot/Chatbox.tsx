"use client";
import React, { useState, useRef, useEffect, SetStateAction } from "react";
import styles from "./chatbox.module.scss";
import Image from "next/image";
import clsx from "clsx";
import { FormattedPaper } from "@/app/api/general-interfaces";
import ReactMarkdown from "react-markdown";

interface MessageInterface {
    id: number;
    sender: string;
    message: string;
    timestamp: string;
}
//It accepts a prop named messages that is type arr of objs with the interface properties
//Interfaces are for defining the types of objects
const Messages = ({ messages }: { messages: MessageInterface[] }) => {
    return (
        <div className={styles.messages}>
            {messages.map((msg: MessageInterface) => (
                <div
                    key={msg.id}
                    className={clsx(styles.message, {
                        [styles.userMessage]: msg.sender === "user",
                        [styles.aiMessage]: msg.sender === "ai",
                    })}
                >
                    <div>
                        <ReactMarkdown>{msg.message}</ReactMarkdown>
                    </div>
                </div>
            ))}
        </div>
    );
};
interface InputProps {
    input: string;
    setInput: React.Dispatch<SetStateAction<string>>;
    handleSubmit: () => void;
}

const Input = ({ input, setInput, handleSubmit }: InputProps) => {
    const handleInput = (evt: any) => {
        const element = evt.target;
        element.style.height = "5px";
        element.style.height = element.scrollHeight + "px";
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSubmit();
        }
    };
    return (
        <div className={styles.chatinput}>
            <textarea
                onInput={handleInput}
                id="messageInput"
                placeholder="Type your message..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
            ></textarea>
            <button onClick={handleSubmit}>
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

const Chatbox = ({ wholePaper }: { wholePaper: FormattedPaper | null }) => {
    const [allMessages, setAllMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");

    //handle the input of messages and outputing messages
    const handleSubmit = async () => {
        setInputMessage("");
        //submitting the input to the messages array
        //first we need to take the input message and push it onto the arr of messages
        const senderMessage = {
            id: 3,
            sender: "user",
            message: inputMessage,
            timestamp: "",
        };
        setAllMessages((prevMessages) => [...prevMessages, senderMessage]);

        const res = await fetch("/api/aichat", {
            method: "POST",
            body: JSON.stringify({
                userResponse: inputMessage,
                wholePaper,
                allMessages,
            }),
        });
        const data = await res.json(); //Data being recieved from the POST request
        const aiResponse = data.aiResponse;
        setAllMessages((prevMessages) => [...prevMessages, aiResponse]);

        console.log(aiResponse);
    };
    return (
        <div className={styles.chatpaperbox}>
            <Messages messages={allMessages} />
            <Input
                input={inputMessage}
                setInput={setInputMessage}
                handleSubmit={handleSubmit}
            />
        </div>
    );
};

export default Chatbox;
