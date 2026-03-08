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

export function getArticleQualityScore(cleanedHtml: string): number {
  const $ = cheerio.load(cleanedHtml);
  const text = normalizedText($.text());

  // Score primarily by text richness and penalize low-signal boilerplate markers.
  let score = Math.min(text.length, 4000);

  for (const phrase of LOW_SIGNAL_PHRASES) {
    if (text.includes(phrase)) {
      score -= 800;
    }
  }

  return Math.max(score, 0);
}

export function isLowQualityArticleHtml(cleanedHtml: string): boolean {
  const score = getArticleQualityScore(cleanedHtml);
  const $ = cheerio.load(cleanedHtml);
  const text = normalizedText($.text());

  if (text.length < 220) {
    return true;
  }

  if (LOW_SIGNAL_PHRASES.some((phrase) => text.includes(phrase))) {
    return true;
  }

  return score < 300;
}
