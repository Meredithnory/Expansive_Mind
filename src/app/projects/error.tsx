"use client";

import RouteError from "../components/RouteError";

export default function ErrorBoundary(props: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <RouteError title="Projects could not load" {...props} />;
}
