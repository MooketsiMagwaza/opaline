import type { Settings } from "../settings/store";

export const AERO_WALLPAPER_URL = new URL("../../assets/wallpapers/opaline-aero.jpg", import.meta.url).href;

export function resolvedBackground(source: Pick<Settings, "backgroundMode" | "customBackground">, desktopUrl: string | null): string | null {
  if (source.backgroundMode === "aero") return AERO_WALLPAPER_URL;
  if (source.backgroundMode === "custom" && source.customBackground) return source.customBackground;
  return desktopUrl;
}

/** Downsample imported wallpapers once so persisted settings and future launches stay lightweight. */
export async function importBackground(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose an image smaller than 20 MB.");
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1920;
  const maxHeight = 1080;
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This image could not be prepared.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const encoded = canvas.toDataURL("image/jpeg", .84);
  if (encoded.length > 3_500_000) throw new Error("This image is still too large after optimisation. Try a smaller image.");
  return encoded;
}
