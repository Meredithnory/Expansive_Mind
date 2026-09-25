export type SiteStatusKind = "beta";

export type SiteStatusNotice = {
    readonly kind: SiteStatusKind;
    readonly label: string;
    readonly srLabel: string;
};

function createSiteStatus(notice: SiteStatusNotice): SiteStatusNotice {
    const label = notice.label.trim();
    const srLabel = notice.srLabel.trim();
    if (label.length === 0 || srLabel.length === 0) {
        throw new Error("Site status copy cannot be empty.");
    }
    return { kind: notice.kind, label, srLabel };
}

// OWNER-EDIT: beta disclosure copy. Keep the visible label short (nav chip).
export const SITE_STATUS: SiteStatusNotice = createSiteStatus({
    kind: "beta",
    label: "Beta",
    srLabel: "Expansive Mind is still in testing.",
});
