// The lab badge: what a reader's character wears and what their name tag
// says. Client-safe; the API validates every write with parseBadgePatch.

export const BADGE_ROLES = [
    "Enthusiast",
    "Undergrad",
    "PhD student",
    "Postdoc",
    "Research scientist",
    "PI",
    "Clinician",
] as const;
export type BadgeRole = (typeof BADGE_ROLES)[number];

export const BADGE_SLOTS = {
    head: [
        { id: "none", name: "Nothing" },
        { id: "goggles", name: "Safety goggles" },
        { id: "gradcap", name: "Grad cap" },
        { id: "headlamp", name: "Headlamp" },
    ],
    hand: [
        { id: "none", name: "Nothing" },
        { id: "flask", name: "Bubbling flask" },
        { id: "pipette", name: "Pipette" },
        { id: "clipboard", name: "Clipboard" },
    ],
    neck: [
        { id: "none", name: "Nothing" },
        { id: "stethoscope", name: "Stethoscope" },
    ],
    sidekick: [
        { id: "none", name: "Nobody" },
        { id: "mouse", name: "Lab mouse" },
        { id: "dna", name: "DNA buddy" },
    ],
    effect: [
        { id: "none", name: "None" },
        { id: "sparkles", name: "Sparkles" },
    ],
} as const;

export type BadgeSlot = keyof typeof BADGE_SLOTS;
export type BadgeItem<S extends BadgeSlot> = (typeof BADGE_SLOTS)[S][number]["id"];

export const BADGE_SLOT_LABELS: Record<BadgeSlot, string> = {
    head: "On your head",
    hand: "In your hand",
    neck: "Around your neck",
    sidekick: "Sidekick",
    effect: "Effect",
};

export const BADGE_SLOT_ORDER: BadgeSlot[] = ["head", "hand", "neck", "sidekick", "effect"];

export const FIELD_MAX = 40;
export const BIO_MAX = 280;

export type Badge = {
    role: BadgeRole | null;
    field: string;
    head: BadgeItem<"head">;
    hand: BadgeItem<"hand">;
    neck: BadgeItem<"neck">;
    sidekick: BadgeItem<"sidekick">;
    effect: BadgeItem<"effect">;
};

export const EMPTY_BADGE: Badge = {
    role: null,
    field: "",
    head: "none",
    hand: "none",
    neck: "none",
    sidekick: "none",
    effect: "none",
};

/** Single line, no control characters, trimmed and capped. */
export function cleanText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    return value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
}

/** Like cleanText but keeps line breaks (max two in a row) for the bio. */
export function cleanBio(value: unknown): string | null {
    if (typeof value !== "string") return null;
    return value
        .replace(/\r\n?/g, "\n")
        .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, BIO_MAX);
}

function isRole(value: unknown): value is BadgeRole {
    return typeof value === "string" && (BADGE_ROLES as readonly string[]).includes(value);
}

function isSlotItem<S extends BadgeSlot>(slot: S, value: unknown): value is BadgeItem<S> {
    return (
        typeof value === "string" &&
        BADGE_SLOTS[slot].some((option) => option.id === value)
    );
}

/** Stored or sent data → a complete badge. Unknown values fall back to defaults. */
export function parseBadge(value: unknown): Badge {
    const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    const badge: Badge = { ...EMPTY_BADGE };
    if (isRole(raw.role)) badge.role = raw.role;
    badge.field = cleanText(raw.field, FIELD_MAX) ?? "";
    for (const slot of BADGE_SLOT_ORDER) {
        if (isSlotItem(slot, raw[slot])) (badge as Record<BadgeSlot, string>)[slot] = raw[slot];
    }
    return badge;
}

export type BadgePatch = Partial<Badge>;

/** A PATCH body's badge → only the valid keys it names, or an error for the first bad one. */
export function parseBadgePatch(value: unknown): { patch: BadgePatch } | { error: string } {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { error: "A valid badge is required." };
    }
    const raw = value as Record<string, unknown>;
    const patch: BadgePatch = {};
    if ("role" in raw) {
        if (raw.role !== null && !isRole(raw.role)) return { error: "Pick one of the roles." };
        patch.role = raw.role as BadgeRole | null;
    }
    if ("field" in raw) {
        const field = cleanText(raw.field, FIELD_MAX);
        if (field === null) return { error: "Field must be text." };
        patch.field = field;
    }
    for (const slot of BADGE_SLOT_ORDER) {
        if (!(slot in raw)) continue;
        if (!isSlotItem(slot, raw[slot])) return { error: `Pick one of the ${BADGE_SLOT_LABELS[slot].toLowerCase()} options.` };
        (patch as Record<BadgeSlot, string>)[slot] = raw[slot] as string;
    }
    return { patch };
}

/** "PhD student · Neuroscience", or whichever part is set. */
export function badgeTagLine(badge: Pick<Badge, "role" | "field"> | null | undefined): string {
    if (!badge) return "";
    return [badge.role, badge.field].filter(Boolean).join(" · ");
}

/** "Signal pink coat · Grad cap · Lab mouse": the outfit in words, for screen readers and About. */
export function describeOutfit(coatLabel: string, badge: Badge): string {
    const extras = BADGE_SLOT_ORDER.map((slot) => badge[slot])
        .filter((item) => item !== "none")
        .map((item) => {
            for (const slot of BADGE_SLOT_ORDER) {
                const option = BADGE_SLOTS[slot].find((o) => o.id === item);
                if (option) return option.name;
            }
            return item;
        });
    return [`${coatLabel} coat`, ...extras].join(" · ");
}
