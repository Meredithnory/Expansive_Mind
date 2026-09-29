import AdminForumReports from "../AdminForumReports";
import styles from "../../admin.module.scss";

export default function AdminReportsPage() {
    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Admin</p>
                    <h1>Forum reports</h1>
                </div>
            </header>
            <AdminForumReports />
        </main>
    );
}
