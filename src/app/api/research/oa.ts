import {
    isCommercialFriendlyLicense,
    normalizeLicense,
} from "../../lib/content-access-policy";
import type { ContentAccessPolicy } from "../../lib/content-access-policy";
import type { OaEvidence } from "./types";

export function oaConflictsWithHome(
    evidence: OaEvidence,
    home: ContentAccessPolicy,
): boolean {
    const oa = normalizeLicense(evidence.rawLicense, evidence.licenseUrl);
    if (oa.normalizedLicense === "UNKNOWN") return false;
    if (!isCommercialFriendlyLicense(home.normalizedLicense)) {
        return false;
    }
    return oa.normalizedLicense === "OTHER";
}
