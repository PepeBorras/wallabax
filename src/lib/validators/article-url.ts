import { z } from "zod";

export function isSupportedArticleSourceUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizeArticleSourceUrl(value: string): string {
  const parsed = new URL(value);

  parsed.hash = "";
  parsed.searchParams.forEach((_, key) => {
    if (key.startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  });

  return parsed.toString();
}

export const articleSourceUrlSchema = z
  .string()
  .url("Enter a valid URL.")
  .refine(isSupportedArticleSourceUrl, {
    message: "Please enter a valid website URL.",
  });

export const createArticleRequestSchema = z.object({
  sourceUrl: articleSourceUrlSchema,
  reprocess: z.boolean().optional().default(false),
});
