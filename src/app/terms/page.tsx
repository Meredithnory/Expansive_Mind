import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../components/LegalPage";
import { DEVELOPER_EMAIL, DEVELOPER_NAME } from "../lib/contact";

export const metadata: Metadata = {
    title: "Terms of Service · Expansive Mind",
    description: "The rules for using Expansive Mind.",
};

const email = <a href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>;

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms of Service"
            updated="September 26, 2026"
            intro={
                <p>
                    These terms cover your use of Expansive Mind
                    (expansivemind.ai), run by {DEVELOPER_NAME}. By using the
                    site, you agree to them. If you do not agree, please do not
                    use it.
                </p>
            }
            sections={[
                {
                    heading: "Your account",
                    body: (
                        <p>
                            Give accurate details when you sign up and keep
                            your password safe. You are responsible for what
                            happens under your account. Tell us right away if
                            you think someone else is using it.
                        </p>
                    ),
                },
                {
                    heading: "What Expansive Mind does",
                    body: (
                        <p>
                            Expansive Mind helps you find, read, and summarize
                            research papers. Answers are generated with AI from
                            published sources and can be incomplete or wrong.
                            Always check the original paper before relying on a
                            finding. Expansive Mind is not medical, legal, or
                            professional advice.
                        </p>
                    ),
                },
                {
                    heading: "Papers and other people's content",
                    body: (
                        <p>
                            Papers and data come from outside publishers and
                            databases, and they belong to their owners. Follow
                            each source&apos;s license. Do not use Expansive
                            Mind to copy or redistribute content you do not
                            have the right to share.
                        </p>
                    ),
                },
                {
                    heading: "Your content",
                    body: (
                        <p>
                            You own the questions, notes, projects, and briefs
                            you create. You give us permission to store and
                            process them only to run the service for you. If
                            you create a share link, anyone with that link can
                            see what you shared.
                        </p>
                    ),
                },
                {
                    heading: "Fair use of the service",
                    body: (
                        <>
                            <p>Please do not:</p>
                            <ul>
                                <li>
                                    Break the law or anyone else&apos;s rights.
                                </li>
                                <li>
                                    Try to get around plan limits, security, or
                                    access controls.
                                </li>
                                <li>
                                    Scrape the site or overload it with
                                    automated requests.
                                </li>
                                <li>Share your account with others.</li>
                            </ul>
                        </>
                    ),
                },
                {
                    heading: "Paid plans",
                    body: (
                        <p>
                            Paid plans are billed through Stripe at the price
                            shown on the <Link href="/pricing">Pricing</Link>{" "}
                            page and renew automatically until you cancel. You
                            can cancel at any time from your billing settings;
                            cancelling stops future charges.
                        </p>
                    ),
                },
                {
                    heading: "Ending your use",
                    body: (
                        <p>
                            You can stop using Expansive Mind and ask us to
                            delete your account at any time. We may suspend or
                            close accounts that break these terms.
                        </p>
                    ),
                },
                {
                    heading: "No guarantees",
                    body: (
                        <p>
                            Expansive Mind is provided &quot;as is.&quot; We
                            work to keep it accurate and available, but we
                            cannot promise it will always be error-free or
                            online. To the extent the law allows, we are not
                            liable for indirect or consequential losses from
                            using it.
                        </p>
                    ),
                },
                {
                    heading: "Changes and contact",
                    body: (
                        <p>
                            If we change these terms, we will update the date
                            at the top. Questions? Email {email}. See also our{" "}
                            <Link href="/privacy">Privacy Policy</Link>.
                        </p>
                    ),
                },
            ]}
        />
    );
}
