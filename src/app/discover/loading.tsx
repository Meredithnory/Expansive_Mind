import RouteLoading from "../components/RouteLoading";
import ResearchOrbit from "../components/ResearchOrbit";

export default function Loading() {
    return (
        <>
            <ResearchOrbit />
            <RouteLoading label="Opening discovery workspace…" />
        </>
    );
}
