/**
 * Browser-side image downscaling for registration uploads.
 *
 * Phone cameras produce 4–12MB JPEGs; ID photos and GCash receipts only need
 * to be legible. Shrinking before upload keeps submissions inside the server
 * action body limit and makes the form usable on mobile data.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export type ResizeResult = { file: File; previewUrl: string };

/**
 * Downscale `file` so its longest edge is at most 1600px and re-encode as
 * JPEG. Returns the original untouched if the browser can't decode it (HEIC on
 * some devices) — the server still validates type and size.
 */
export async function downscaleImage(file: File): Promise<ResizeResult> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough and already a web-friendly format: leave it alone.
    if (scale === 1 && file.type === "image/jpeg" && file.size < 1_500_000) {
      bitmap.close();
      return { file, previewUrl: URL.createObjectURL(file) };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) throw new Error("encode failed");

    const name = file.name.replace(/\.[^.]+$/, "") || "upload";
    const resized = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    return { file: resized, previewUrl: URL.createObjectURL(resized) };
  } catch {
    return { file, previewUrl: URL.createObjectURL(file) };
  }
}
