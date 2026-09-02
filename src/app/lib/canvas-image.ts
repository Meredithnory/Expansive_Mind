export const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;

const canvasBlob = (
    canvas: HTMLCanvasElement,
    type: "image/png" | "image/jpeg",
    quality?: number,
) =>
    new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) =>
                blob
                    ? resolve(blob)
                    : reject(new Error("The screenshot could not be prepared.")),
            type,
            quality,
        );
    });

export async function fileFromCanvas(
    canvas: HTMLCanvasElement,
    basename: string,
) {
    const png = await canvasBlob(canvas, "image/png");
    if (png.size <= MAX_CAPTURE_BYTES) {
        return new File([png], `${basename}.png`, { type: png.type });
    }

    for (const quality of [0.92, 0.82, 0.72]) {
        const jpeg = await canvasBlob(canvas, "image/jpeg", quality);
        if (jpeg.size <= MAX_CAPTURE_BYTES) {
            return new File([jpeg], `${basename}.jpg`, { type: jpeg.type });
        }
    }
    throw new Error("The captured image is larger than 5 MB. Crop it further.");
}
