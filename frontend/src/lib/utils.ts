import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns a random integer inclusive on both ends. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const ULID_CHARS = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulidLike(): string {
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ULID_CHARS[Math.floor(Math.random() * ULID_CHARS.length)];
  }
  return out.toLowerCase();
}

export function id(prefix: string): string {
  return `${prefix}_${ulidLike()}${ulidLike()}`;
}
