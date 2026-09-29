import type { Metadata } from "next";
import { Suspense } from "react";
import BadgeEditor from "./BadgeEditor";

export const metadata: Metadata = {
    title: "Your lab badge · Expansive Mind",
};

export default function BadgePage() {
    return (
        <Suspense fallback={null}>
            <BadgeEditor />
        </Suspense>
    );
}
