import { ImageResponse } from "next/og";
import {
    briefPreviewText,
    findSharedBrief,
} from "../../lib/shared-brief";

export const runtime = "nodejs";
export const alt = "Research brief on Expansive Mind";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const shared = await findSharedBrief(slug);

    const eyebrow = shared
        ? shared.kind === "paper"
            ? "RESEARCH BRIEF"
            : "EVIDENCE SYNTHESIS"
        : "EXPANSIVE MIND";
    const title = shared ? shared.title : "Research brief";
    const preview = shared ? briefPreviewText(shared.brief, 180) : "";
    const sourceLine = shared
        ? [shared.sourceLabel, shared.publicationDate]
              .filter(Boolean)
              .join(" · ")
        : "";

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "64px 72px",
                    background:
                        "linear-gradient(160deg, #1a0210 0%, #0d0d0d 45%)",
                    color: "#e8f2ff",
                    fontFamily: "sans-serif",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "26px",
                    }}
                >
                    <div
                        style={{
                            color: "#ff0084",
                            fontSize: 26,
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                        }}
                    >
                        {eyebrow}
                    </div>
                    <div
                        style={{
                            fontSize: title.length > 90 ? 44 : 54,
                            fontWeight: 700,
                            lineHeight: 1.2,
                            letterSpacing: "-0.02em",
                            color: "#d7ebff",
                            display: "block",
                            lineClamp: 3,
                        }}
                    >
                        {title}
                    </div>
                    {preview && (
                        <div
                            style={{
                                fontSize: 27,
                                lineHeight: 1.45,
                                color: "rgba(215, 235, 255, 0.72)",
                                display: "block",
                                lineClamp: 3,
                            }}
                        >
                            {preview}
                        </div>
                    )}
                </div>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderTop: "1px solid rgba(255, 0, 132, 0.4)",
                        paddingTop: "28px",
                    }}
                >
                    <div
                        style={{
                            fontSize: 30,
                            fontWeight: 700,
                            color: "#ffffff",
                        }}
                    >
                        Expansive Mind
                    </div>
                    <div
                        style={{
                            fontSize: 24,
                            color: "rgba(215, 235, 255, 0.6)",
                        }}
                    >
                        {sourceLine}
                    </div>
                </div>
            </div>
        ),
        size,
    );
}
