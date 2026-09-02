export const FIGURE_CAPTURE_METHODS = [
    "upload",
    "paste",
    "screen_capture",
    "page_region",
] as const;

export type FigureCaptureMethod = (typeof FIGURE_CAPTURE_METHODS)[number];

export const FIGURE_RIGHTS_ATTESTATION_VERSION = "figure-rights-v1";

export interface CropInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export function isFigureCaptureMethod(
    value: string,
): value is FigureCaptureMethod {
    return FIGURE_CAPTURE_METHODS.includes(value as FigureCaptureMethod);
}

export function calculateCropRect(
    width: number,
    height: number,
    insets: CropInsets,
) {
    const clamp = (value: number) => Math.min(40, Math.max(0, value));
    const top = clamp(insets.top);
    const right = clamp(insets.right);
    const bottom = clamp(insets.bottom);
    const left = clamp(insets.left);
    const x = Math.round((width * left) / 100);
    const y = Math.round((height * top) / 100);
    const cropWidth = Math.max(
        1,
        Math.round(width - (width * (left + right)) / 100),
    );
    const cropHeight = Math.max(
        1,
        Math.round(height - (height * (top + bottom)) / 100),
    );

    return { x, y, width: cropWidth, height: cropHeight };
}
