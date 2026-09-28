import styles from "./styles/legal-page.module.scss";

export type LegalSection = {
    heading: string;
    body: React.ReactNode;
};

export default function LegalPage({
    title,
    updated,
    intro,
    sections,
}: {
    title: string;
    updated: string;
    intro: React.ReactNode;
    sections: LegalSection[];
}) {
    return (
        <main className={styles.page}>
            <article className={styles.card}>
                <header className={styles.header}>
                    <h1>{title}</h1>
                    <p className={styles.updated}>Last updated {updated}</p>
                    <div className={styles.intro}>{intro}</div>
                </header>
                {sections.map((section) => (
                    <section key={section.heading} className={styles.section}>
                        <h2>{section.heading}</h2>
                        {section.body}
                    </section>
                ))}
            </article>
        </main>
    );
}
