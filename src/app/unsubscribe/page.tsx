import type { Metadata } from "next";
import Link from "next/link";
import { verifyUnsubscribeToken } from "../lib/email-unsubscribe";
import UnsubscribeButton from "./UnsubscribeButton";
import styles from "./unsubscribe.module.scss";

export const metadata: Metadata = {
    title: "Unsubscribe · Expansive Mind",
    robots: { index: false },
};

// A click, not a page load, turns email off: mail scanners open links too.
export default async function UnsubscribePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const raw = (await searchParams).token;
    const token = Array.isArray(raw) ? raw[0] : raw;
    const valid = Boolean(verifyUnsubscribeToken(token));
    return (
        <main className={styles.page}>
            <section className={styles.card} aria-labelledby="unsubscribe-title">
                <p className={styles.eyebrow}>Product email</p>
                <h1 id="unsubscribe-title">
                    {valid ? "Stop product email?" : "This link doesn't work"}
                </h1>
                {valid && token ? (
                    <>
                        <p>
                            You&apos;ll stop getting news from the Expansive Mind team.
                            Account email, like password resets, still comes.
                        </p>
                        <UnsubscribeButton token={token} />
                    </>
                ) : (
                    <p>
                        It may be incomplete. You can turn product email off on your{" "}
                        <Link href="/profile">profile</Link>.
                    </p>
                )}
            </section>
        </main>
    );
}
