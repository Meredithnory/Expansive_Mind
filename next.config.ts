import type { NextConfig } from "next";

/**
 * Security response headers live here (Next `headers()`), not in vercel.json.
 * vercel.json only sets install/build commands so we do not duplicate or conflict.
 *
 * CSP in plain language:
 * - Default everything to same-origin.
 * - Scripts/styles from this app only; inline allowed for Next.js hydration/CSS.
 * - Images from self plus the paper/CDN hosts configured in images.remotePatterns.
 * - Fonts self-hosted via next/font (no Google Fonts runtime fetch).
 * - Analytics connect to PostHog US cloud when NEXT_PUBLIC_POSTHOG_* is set.
 * - No object embeds; framing limited to same origin; HTTPS upgrade on TLS hosts.
 * - Stripe Checkout is a full-page redirect (no Stripe.js embed), so no Stripe script hosts.
 */
const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://pmc.ncbi.nlm.nih.gov https://cdn.ncbi.nlm.nih.gov https://pmc-oa-opendata.s3.amazonaws.com https://media.springernature.com https://static-content.springer.com https://link.springer.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.posthog.com https://*.i.posthog.com",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

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
                headers: securityHeaders,
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
