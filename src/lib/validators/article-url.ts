import { z } from "zod";

const ALLOWED_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);

export function isSupportedArticleSourceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const normalizedPath = parsed.pathname.toLowerCase();

    if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return false;
    }

    const isLongFormPath = /^\/i\/article(s)?\//.test(normalizedPath);
    const isStatusPath = /^\/[a-z0-9_]{1,20}\/status\/[0-9]+\/?$/.test(normalizedPath);

    return isLongFormPath || isStatusPath;
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
    message: "Only public X article or status URLs are supported right now.",
  });

export const createArticleRequestSchema = z.object({
  sourceUrl: articleSourceUrlSchema,
  reprocess: z.boolean().optional().default(false),
});
