import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function formatMsPrecise(ms: number) {
  const whole = Math.max(0, ms);
  const minutes = Math.floor(whole / 60_000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((whole % 60_000) / 1000)
    .toString()
    .padStart(2, "0");
  const millis = Math.floor(whole % 1000)
    .toString()
    .padStart(3, "0");

  return `${minutes}:${seconds}.${millis}`;
}

export function absoluteUrl(origin: string, relativeUrl: string) {
  return new URL(relativeUrl, origin).toString();
}

export function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function createId() {
  return crypto.randomUUID();
}

export function fileNameFromPath(filePath: string) {
  const parts = filePath.split(/[\\/]/);

  return parts[parts.length - 1] ?? filePath;
}

export function slugify(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized;
}
