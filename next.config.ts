import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    distDir:
        process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "pmc.ncbi.nlm.nih.gov" },
            { protocol: "https", hostname: "cdn.ncbi.nlm.nih.gov" },
            {
                protocol: "https",
                hostname: "pmc-oa-opendata.s3.amazonaws.com",
            },
            { protocol: "https", hostname: "media.springernature.com" },
            { protocol: "https", hostname: "static-content.springer.com" },
            { protocol: "https", hostname: "link.springer.com" },
        ],
    },
    reactStrictMode: false,
    devIndicators: {
        position: "bottom-right",
    },
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
                ],
            },
            {
                source: "/:file(dnabg.mov|dnabg.mp4|dnabg.webm|dnabg-hd.mp4|dnabg-hd.webm|dnabg-poster.jpg)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, stale-while-revalidate=86400",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
