import ReactMarkdown from "react-markdown";

/** AI prose must never initiate external requests or create arbitrary outbound links.
 * Source navigation belongs to server-validated citation controls, not model text.
 */
export default function SafeAssistantMarkdown({children}: {children:string}) {
    return <ReactMarkdown skipHtml disallowedElements={["img", "a"]} unwrapDisallowed>{children}</ReactMarkdown>;
}
