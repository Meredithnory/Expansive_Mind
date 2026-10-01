import clsx from "clsx";
import { attributedQuote } from "../lib/quote-eligibility";
import { REPLAY_MASK } from "../lib/replay-privacy";

/** Renders a verbatim passage only when the title and a resolvable link are both present. */
export default function QuoteWithAttribution({
    quote,
    title,
    link,
    className,
}: {
    quote?: string | null;
    title?: string | null;
    link?: string | null;
    className?: string;
}) {
    const shown = attributedQuote({ quote, title, link });
    if (!shown) return null;
    const external = /^https?:\/\//i.test(shown.link);
    return (
        <figure style={{ margin: 0 }}>
            <blockquote className={clsx(className, REPLAY_MASK)}>{shown.quote}</blockquote>
            <figcaption>
                <a
                    href={shown.link}
                    {...(external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                >
                    {shown.title}
                </a>
            </figcaption>
        </figure>
    );
}
