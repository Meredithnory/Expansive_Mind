import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        domains: ["cdn.ncbi.nlm.nih.gov"],
    },
    reactStrictMode: false,
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
