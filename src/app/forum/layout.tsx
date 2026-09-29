import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Forum · Expansive Mind",
    description:
        "Researchers sharing papers, highlights, and takes, with every quote tied to its source.",
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
    return children;
}
