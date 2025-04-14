import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { get_encoding } from "tiktoken";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
