"use client";

import RouteError from "../components/RouteError";

export default function ErrorBoundary(props: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <RouteError title="Your library could not load" {...props} />;
}
