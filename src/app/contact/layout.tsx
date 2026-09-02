import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact · Expansive Mind",
    description:
        "Write to Meredith Staton, the developer of Expansive Mind.",
};

export default function ContactLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
