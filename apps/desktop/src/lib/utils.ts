import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUniqueProfileName(
  baseName: string,
  existingProfiles: Array<{ name: string }>,
  suffix?: string
): string {
  let finalName = suffix ? `${baseName} ${suffix}` : baseName;
  let counter = 1;

  while (existingProfiles.some((p) => p.name === finalName)) {
    finalName = suffix
      ? `${baseName} ${suffix} ${counter}`
      : `${baseName} (${counter})`;
    counter++;
  }

  return finalName;
}
