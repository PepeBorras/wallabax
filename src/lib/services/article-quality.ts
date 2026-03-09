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

function getMeaningfulBlockCount(cleanedHtml: string): number {
  const $ = cheerio.load(cleanedHtml);

  return $("#reader-article p, #reader-article li, #reader-article h2, #reader-article h3, #reader-article blockquote")
    .toArray()
    .map((node) => normalizedText($(node).text()))
    .filter((text) => text.length >= 40).length;
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
  const meaningfulBlockCount = getMeaningfulBlockCount(cleanedHtml);
  const hasRichStructure = $("#reader-article img, #reader-article ul, #reader-article ol, #reader-article table").length > 0;
  const hasLowSignalPhrase = LOW_SIGNAL_PHRASES.some((phrase) => text.includes(phrase));

  // Hard fail only when very short and structurally sparse.
  if (text.length < 140 && meaningfulBlockCount < 2 && !hasRichStructure) {
    return true;
  }

  // Boilerplate markers are a strong signal only when content is also thin.
  if (hasLowSignalPhrase && text.length < 380 && meaningfulBlockCount < 3 && !hasRichStructure) {
    return true;
  }

  return score < 220 && meaningfulBlockCount < 2 && !hasRichStructure;
}
