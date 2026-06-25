import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip a leading "Caption:" label that LLMs sometimes prepend to generated
 * captions (e.g. "**Caption:**", "Caption:", "### Caption", "Caption —").
 * Only removes the label when it appears at the very start of the text.
 */
export function stripCaptionLabel(text: string | null | undefined): string {
  if (!text) return "";
  let out = String(text);
  const re = /^\s*(?:#{1,6}\s*)?(?:\*{1,3}|_{1,3})?\s*caption\s*(?:\*{1,3}|_{1,3})?\s*[:\-—–]?\s*\n?/i;
  out = out.replace(re, "");
  return out.trimStart();
}
