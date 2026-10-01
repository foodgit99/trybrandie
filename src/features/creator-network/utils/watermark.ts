/**
 * Burns a repeated diagonal "PREVIEW — BRANDIE" pattern across the whole image
 * (not a croppable corner mark). Returns a PNG Blob.
 */
export async function watermarkImage(src: string | Blob, text = "PREVIEW — BRANDIE"): Promise<Blob> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load image for watermarking"));
    i.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const size = Math.max(18, Math.round(canvas.width / 22));
  ctx.font = `600 ${size}px 'DM Sans', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  const stepX = size * 12;
  const stepY = size * 4;
  const span = Math.hypot(canvas.width, canvas.height);
  for (let y = -span; y < span; y += stepY) {
    for (let x = -span; x < span; x += stepX) {
      const off = (Math.round(y / stepY) % 2) * (stepX / 2);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillText(text, x + off, y);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillText(text, x + off + 1.5, y + 1.5);
    }
  }
  ctx.restore();
  if (typeof src !== "string") URL.revokeObjectURL(url);
  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Watermark failed"))), "image/png"));
}
