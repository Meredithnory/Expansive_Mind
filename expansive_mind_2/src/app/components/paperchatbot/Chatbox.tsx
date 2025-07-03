"use client";
import React, {
    useState,
    useRef,
    useEffect,
    SetStateAction,
    useCallback,
} from "react";
import styles from "./chatbox.module.scss";
import Image from "next/image";
import clsx from "clsx";
import { FormattedPaper } from "@/app/api/general-interfaces";
import ReactMarkdown from "react-markdown";

//Interface

interface MessageInterface {
    id: number;
    sender: string;
    message: string;
    timestamp: string;
}
//Messaging component from AI chatbot
const Message = ({
    message,
    onContentUpdate,
}: {
    message: string;
    onContentUpdate: () => void;
}) => {
    const [content, setContent] = useState("");

    useEffect(() => {
        let count = 0;
        setContent("");

        const intervalId = setInterval(() => {
            if (count < message.length) {
                count++;
                setContent(message.slice(0, count));
                onContentUpdate();
            } else {
                clearInterval(intervalId);
            }
        }, 20);

        return () => {
            clearInterval(intervalId);
        };
    }, [message, onContentUpdate]);

    return <ReactMarkdown>{content}</ReactMarkdown>;
};
//It accepts a prop named messages that is type arr of objs with the interface properties
const Messages = ({ messages }: { messages: MessageInterface[] }) => {
    const messagesRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, []);

    return (
        <div className={styles.messages} ref={messagesRef}>
            {messages.map((msg: MessageInterface) => (
                <div
                    key={msg.id}
                    className={clsx(styles.message, {
                        [styles.userMessage]: msg.sender === "user",
                        [styles.aiMessage]: msg.sender === "ai",
                    })}
                >
                    {msg.sender === "ai" ? (
                        <Message
                            message={msg.message}
                            onContentUpdate={scrollToBottom}
                        />
                    ) : (
                        <div> {msg.message} </div>
                    )}
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
    const [allMessages, setAllMessages] = useState([
        {
            id: 1,
            sender: "ai",
            message:
                "Hello! How are you today? When you've had the chance to look over the paper, is there a particular section or finding you're curious about? I'm here to help with any questions you might have!",
        },
    ]);
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
