import * as cheerio from "cheerio";

const LOW_SIGNAL_PHRASES = [
  "content could not be cleanly extracted",
  "don’t miss what’s happening",
  "don't miss what's happening",
  "see new posts",
  "log in",
  "sign up",
  "this page is not supported",
];

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function isLowQualityArticleHtml(cleanedHtml: string): boolean {
  const $ = cheerio.load(cleanedHtml);
  const text = normalizedText($.text());

  if (text.length < 220) {
    return true;
  }

  return LOW_SIGNAL_PHRASES.some((phrase) => text.includes(phrase));
}
