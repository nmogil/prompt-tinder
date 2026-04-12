/**
 * Strip EXIF metadata from an image file by re-encoding through a canvas.
 * Only processes image/* MIME types; other files pass through unchanged.
 */
export async function stripExif(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);

      // Determine output type — keep PNG as PNG, everything else as JPEG
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(blob);
        },
        outputType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for EXIF stripping"));
    };

    img.src = url;
  });
}
