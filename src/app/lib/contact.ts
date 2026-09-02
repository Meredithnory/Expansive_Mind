export const DEVELOPER_EMAIL = "mernstaton@gmail.com";
export const DEVELOPER_NAME = "Meredith Staton";

export const CONTACT_TOPICS = [
    "Question",
    "Feedback",
    "Bug",
    "Other",
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export type ContactFields = {
    name: string;
    email: string;
    topic: ContactTopic;
    message: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;
const MAX_MESSAGE = 1500;

function asTrimmedString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export function isContactTopic(value: string): value is ContactTopic {
    return CONTACT_TOPICS.includes(value as ContactTopic);
}

export function parseContactFields(input: {
    name?: unknown;
    email?: unknown;
    topic?: unknown;
    message?: unknown;
    website?: unknown;
}): { ok: true; fields: ContactFields; spam: boolean } | { ok: false; error: string } {
    if (asTrimmedString(input.website)) {
        return {
            ok: true,
            spam: true,
            fields: {
                name: "spam",
                email: "spam@example.com",
                topic: "Other",
                message: "spam",
            },
        };
    }

    const name = asTrimmedString(input.name);
    const email = asTrimmedString(input.email).toLowerCase();
    const topic = asTrimmedString(input.topic);
    const message = asTrimmedString(input.message);

    if (!name) return { ok: false, error: "Please add your name." };
    if (name.length > MAX_NAME) {
        return { ok: false, error: "That name is a little long." };
    }
    if (!EMAIL_PATTERN.test(email)) {
        return { ok: false, error: "Please use a valid email so Meredith can reply." };
    }
    if (!isContactTopic(topic)) {
        return { ok: false, error: "Please choose a topic." };
    }
    if (message.length < 8) {
        return { ok: false, error: "A few more words will help Meredith help you." };
    }
    if (message.length > MAX_MESSAGE) {
        return {
            ok: false,
            error: `Keep it under ${MAX_MESSAGE} characters — a short note is perfect.`,
        };
    }

    return {
        ok: true,
        spam: false,
        fields: { name, email, topic, message },
    };
}

export function contactMailto(fields: ContactFields) {
    const subject = `Expansive Mind — ${fields.topic}`;
    const body = `From: ${fields.name} <${fields.email}>\n\n${fields.message}`;
    return `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function contactTextBody(fields: ContactFields) {
    return [
        `From: ${fields.name}`,
        `Email: ${fields.email}`,
        `Topic: ${fields.topic}`,
        "",
        fields.message,
    ].join("\n");
}
