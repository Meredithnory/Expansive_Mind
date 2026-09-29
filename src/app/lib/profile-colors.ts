// Coat colors a reader can pick for their lab badge (profileColor). Pulled
// from the Expansive Mind logo so every choice still looks on-brand.
// `shade` colors the lapels and pocket; `ink` is readable text on `hex`.
export const PROFILE_COLORS = [
    { id: "pink", label: "Signal pink", hex: "#ff0084", shade: "#b8005f", ink: "#ffffff" },
    { id: "blue", label: "Lab blue", hex: "#0ab1ff", shade: "#0677ad", ink: "#04151f" },
    { id: "purple", label: "Violet", hex: "#9b5de5", shade: "#6a35b5", ink: "#ffffff" },
    { id: "orange", label: "Amber", hex: "#f7a531", shade: "#b8740b", ink: "#1a1206" },
    { id: "green", label: "Moss", hex: "#3fbf6f", shade: "#23854a", ink: "#04170b" },
    { id: "teal", label: "Teal", hex: "#1ec8c8", shade: "#0e8585", ink: "#04201d" },
    { id: "white", label: "Classic white", hex: "#e9edf3", shade: "#b9c2cf", ink: "#141418" },
] as const;

export type ProfileColor = (typeof PROFILE_COLORS)[number]["id"];
export type CoatColor = (typeof PROFILE_COLORS)[number];

export const DEFAULT_PROFILE_COLOR: ProfileColor = "pink";

export const PROFILE_COLOR_IDS = PROFILE_COLORS.map((color) => color.id);

export function parseProfileColor(value: unknown): ProfileColor | null {
    return typeof value === "string" &&
        (PROFILE_COLOR_IDS as readonly string[]).includes(value)
        ? (value as ProfileColor)
        : null;
}

export function coatColor(value: unknown): CoatColor {
    const id = parseProfileColor(value) ?? DEFAULT_PROFILE_COLOR;
    return PROFILE_COLORS.find((color) => color.id === id)!;
}

export function profileColorHex(value: unknown): string {
    return coatColor(value).hex;
}
