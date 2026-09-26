// Brand colors a reader can pick for their profile mark. Pulled from the
// Expansive Mind logo so every choice still looks on-brand.
export const PROFILE_COLORS = [
    { id: "pink", label: "Pink", hex: "#ff0084" },
    { id: "blue", label: "Blue", hex: "#0ab1ff" },
    { id: "purple", label: "Purple", hex: "#9b5de5" },
    { id: "orange", label: "Orange", hex: "#f7a531" },
    { id: "green", label: "Green", hex: "#3fbf6f" },
    { id: "teal", label: "Teal", hex: "#1ec8c8" },
] as const;

export type ProfileColor = (typeof PROFILE_COLORS)[number]["id"];

export const DEFAULT_PROFILE_COLOR: ProfileColor = "pink";

export const PROFILE_COLOR_IDS = PROFILE_COLORS.map((color) => color.id);

export function parseProfileColor(value: unknown): ProfileColor | null {
    return typeof value === "string" &&
        (PROFILE_COLOR_IDS as readonly string[]).includes(value)
        ? (value as ProfileColor)
        : null;
}

export function profileColorHex(value: unknown): string {
    const id = parseProfileColor(value) ?? DEFAULT_PROFILE_COLOR;
    return PROFILE_COLORS.find((color) => color.id === id)!.hex;
}
