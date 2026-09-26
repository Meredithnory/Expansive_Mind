import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "../components/LegalPage";
import { DEVELOPER_EMAIL, DEVELOPER_NAME } from "../lib/contact";

export const metadata: Metadata = {
    title: "Privacy Policy · Expansive Mind",
    description: "What Expansive Mind collects, why, and who it is shared with.",
};

const email = <a href={`mailto:${DEVELOPER_EMAIL}`}>{DEVELOPER_EMAIL}</a>;

export default function PrivacyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            updated="September 26, 2026"
            intro={
                <p>
                    Expansive Mind (expansivemind.ai) is a research tool run by{" "}
                    {DEVELOPER_NAME}. This page explains what we collect when
                    you use it, why, and who we share it with. We do not sell
                    your information.
                </p>
            }
            sections={[
                {
                    heading: "What we collect",
                    body: (
                        <ul>
                            <li>
                                <strong>Account details:</strong> your name,
                                email address, and password. Passwords are
                                stored only as a secure hash, never as plain
                                text.
                            </li>
                            <li>
                                <strong>Google sign-in:</strong> if you choose
                                Continue with Google, Google shares your name,
                                email address, and Google account ID with us.
                                We do not get your Google password or access to
                                your Gmail, Drive, or contacts.
                            </li>
                            <li>
                                <strong>Your research:</strong> the questions
                                you ask, papers you save, highlights, projects,
                                chats about papers, and briefs you create.
                            </li>
                            <li>
                                <strong>Billing:</strong> if you upgrade,
                                Stripe handles your payment. We keep your plan
                                and Stripe customer ID. We never see or store
                                your full card number.
                            </li>
                            <li>
                                <strong>Usage:</strong> which pages you visit,
                                how long you stay, and how many searches you
                                use, so we can enforce plan limits and improve
                                the product.
                            </li>
                            <li>
                                <strong>Messages:</strong> anything you send
                                through the Contact page.
                            </li>
                        </ul>
                    ),
                },
                {
                    heading: "How we use it",
                    body: (
                        <ul>
                            <li>To run your account and sign you in.</li>
                            <li>
                                To find papers and answer your research
                                questions.
                            </li>
                            <li>To apply your plan and its limits.</li>
                            <li>
                                To send account emails, such as password reset
                                links.
                            </li>
                            <li>
                                To keep the service secure and fix problems.
                            </li>
                        </ul>
                    ),
                },
                {
                    heading: "Who we share it with",
                    body: (
                        <>
                            <p>
                                We use a small set of service providers to run
                                Expansive Mind. Each gets only what it needs.
                            </p>
                            <ul>
                                <li>
                                    <strong>AI models</strong> (through
                                    OpenRouter): your questions and the paper
                                    text needed to answer them.
                                </li>
                                <li>
                                    <strong>Research databases</strong> such as
                                    PubMed, Europe PMC, OpenAlex, Unpaywall,
                                    Springer Nature, and Google Scholar (through
                                    SerpApi): your search terms.
                                </li>
                                <li>
                                    <strong>Stripe</strong> for payments.
                                </li>
                                <li>
                                    <strong>Google</strong> for Continue with
                                    Google.
                                </li>
                                <li>
                                    <strong>PostHog</strong> for product
                                    analytics, linked to your account ID and
                                    plan.
                                </li>
                                <li>
                                    <strong>Resend</strong> to deliver emails.
                                </li>
                                <li>
                                    <strong>Vercel</strong> and{" "}
                                    <strong>MongoDB</strong> to host the site
                                    and store data.
                                </li>
                            </ul>
                            <p>
                                If you create a share link, anyone with that
                                link can see what you shared. We may also
                                disclose information if the law requires it.
                            </p>
                        </>
                    ),
                },
                {
                    heading: "Google user data",
                    body: (
                        <p>
                            We use the information Google shares only to create
                            your account and sign you in. We do not use it for
                            ads, we do not sell it, and we do not share it with
                            anyone except as needed to run the service. Our use
                            of information received from Google APIs follows
                            the{" "}
                            <a
                                href="https://developers.google.com/terms/api-services-user-data-policy"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Google API Services User Data Policy
                            </a>
                            , including its Limited Use requirements.
                        </p>
                    ),
                },
                {
                    heading: "Cookies",
                    body: (
                        <p>
                            We use cookies to keep you signed in, to complete
                            Google sign-in safely, and to count visits without
                            knowing who you are. The visit counter is stored as
                            a scrambled key and deleted after 120 days. We do
                            not use advertising cookies.
                        </p>
                    ),
                },
                {
                    heading: "How long we keep it",
                    body: (
                        <p>
                            We keep your account and research while your
                            account is open. If you ask us to delete your
                            account, we delete your account data, except
                            records we must keep for billing or legal reasons.
                        </p>
                    ),
                },
                {
                    heading: "Your choices",
                    body: (
                        <p>
                            You can ask to see, correct, export, or delete your
                            information at any time by emailing {email}. You
                            can also remove Expansive Mind&apos;s access to your
                            Google account from your Google account settings.
                        </p>
                    ),
                },
                {
                    heading: "California residents",
                    body: (
                        <p>
                            If you live in California, you have the right to
                            know what personal information we collect, to ask
                            us to delete or correct it, and to not be
                            discriminated against for using these rights. We do
                            not sell or share your personal information for
                            advertising. To make a request, email {email}.
                        </p>
                    ),
                },
                {
                    heading: "Security",
                    body: (
                        <p>
                            We use encrypted connections, hashed passwords, and
                            limited access to protect your information. No
                            system is perfectly secure, so please use a strong
                            password.
                        </p>
                    ),
                },
                {
                    heading: "Children",
                    body: (
                        <p>
                            Expansive Mind is not meant for children under 13,
                            and we do not knowingly collect their information.
                        </p>
                    ),
                },
                {
                    heading: "Changes and contact",
                    body: (
                        <p>
                            If we change this policy, we will update the date
                            at the top. Questions? Email {email} or use the{" "}
                            <Link href="/contact">Contact page</Link>. See also
                            our <Link href="/terms">Terms of Service</Link>.
                        </p>
                    ),
                },
            ]}
        />
    );
}
