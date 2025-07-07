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
import { FormattedPaper } from "../../api/general-interfaces";
import ReactMarkdown from "react-markdown";

//Interface

interface MessageInterface {
    id: number;
    sender: string;
    message: string;
    timestamp: Date;
    animate?: boolean;
}
//Messaging component from AI chatbot
const Message = ({
    message,
    onContentUpdate,
    animate,
    isLastMessage,
}: {
    message: string;
    animate: boolean;
    isLastMessage: boolean;
    onContentUpdate: () => void;
}) => {
    const [content, setContent] = useState("");

    useEffect(() => {
        if (animate && isLastMessage) {
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
        } else {
            setContent(message);
        }
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
            {messages.map((msg: MessageInterface, index) => (
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
                            animate={msg.animate}
                            isLastMessage={index === messages.length - 1}
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
//Input component
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
interface ChatboxProps {
    wholePaper: FormattedPaper | null;
    highlightedText: string;
    allMessages: MessageInterface[];
    setAllMessages: React.Dispatch<SetStateAction<MessageInterface[]>>;
}

const Chatbox = ({
    wholePaper,
    highlightedText,
    allMessages,
    setAllMessages,
}: ChatboxProps) => {
    const [inputMessage, setInputMessage] = useState("");

    //handle the input of messages and outputing messages
    const handleSubmit = async () => {
        //submitting the input to the messages array
        //first we need to take the input message and push it onto the arr of messages
        const senderMessage = {
            id: allMessages.length,
            sender: "user",
            message: inputMessage,
            timestamp: new Date(),
        };
        //All the previous messages from allMessages spread into the arr with the sender Message
        setAllMessages((prevMessages) => [...prevMessages, senderMessage]);
        //Clearing the input text area
        setInputMessage("");
        //Send to aichat backend for the ai to process the conversation
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
        aiResponse.animate = true;
        setAllMessages((prevMessages) => [...prevMessages, aiResponse]);
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
