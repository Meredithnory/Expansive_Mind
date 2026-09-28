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
                    heading: "The public forum and groups",
                    body: (
                        <>
                            <p>
                                Posts and comments in the public forum can be
                                read by anyone, including people without an
                                account. Group posts are seen only by that
                                group&apos;s members. In both, please:
                            </p>
                            <ul>
                                <li>Be respectful. No harassment, hate, or personal attacks.</li>
                                <li>No spam, advertising, or self-promotion unrelated to the research.</li>
                                <li>
                                    Represent research honestly. Don&apos;t misstate
                                    what a paper found.
                                </li>
                                <li>
                                    Don&apos;t post text you don&apos;t have the right to
                                    share. Expansive Mind only shows quoted paper
                                    text when the paper&apos;s license allows it.
                                </li>
                                <li>No private information about other people.</li>
                            </ul>
                            <p>
                                You keep ownership of what you post and give us
                                permission to display it on Expansive Mind. We may
                                hide or remove posts and suspend accounts that
                                break these rules. Anyone can report a post; items
                                reported by several people are hidden until we
                                review them.
                            </p>
                        </>
                    ),
                },
                {
                    heading: "Paid plans",
                    body: (
                        <p>
                            Paid plans are billed through Stripe at the price
                            shown on the <Link href="/pricing">Pricing</Link>{" "}
                            page and renew automatically each month or year
                            until you cancel. You can cancel online at any time
                            from Manage billing on the Pricing page. Cancelling
                            stops future charges.
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
                    heading: "Copyright complaints",
                    body: (
                        <>
                            <p>
                                We respond to notices of copyright infringement
                                under the Digital Millennium Copyright Act
                                (DMCA). Our designated agent is {DEVELOPER_NAME},
                                reachable at {email}. A notice should include:
                            </p>
                            <ul>
                                <li>the copyrighted work you believe was infringed;</li>
                                <li>
                                    the link to the post or comment on
                                    Expansive Mind where it appears;
                                </li>
                                <li>your name, address, phone number, and email;</li>
                                <li>
                                    a statement that you believe in good faith
                                    the use isn&apos;t authorized by the owner,
                                    its agent, or the law;
                                </li>
                                <li>
                                    a statement, under penalty of perjury, that
                                    your notice is accurate and that you are the
                                    owner or authorized to act for them; and
                                </li>
                                <li>your physical or electronic signature.</li>
                            </ul>
                            <p>
                                We remove material identified in a valid notice
                                promptly. If your post was removed and you
                                believe that was a mistake, you can send a
                                counter-notice to the same address; we may then
                                restore it as the law allows.
                            </p>
                            <p>
                                We close the accounts of people who repeatedly
                                post material that infringes others&apos;
                                copyrights.
                            </p>
                        </>
                    ),
                },
                {
                    heading: "Governing law",
                    body: (
                        <p>
                            These terms are governed by the laws of the State
                            of California, without regard to its conflict of
                            law rules.
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
