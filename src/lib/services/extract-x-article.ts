import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import rehypeStringify from "rehype-stringify";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import type { ExtractedArticle } from "@/lib/types/article";

type SyndicationUser = {
  name?: string;
  screen_name?: string;
};

type SyndicationPhoto = {
  url?: string;
};

type SyndicationVideoVariant = {
  src?: string;
  type?: string;
  bitrate?: number;
};

type SyndicationVideo = {
  poster?: string;
  variants?: SyndicationVideoVariant[];
};

type SyndicationTweet = {
  text?: string;
  created_at?: string;
  user?: SyndicationUser;
  photos?: SyndicationPhoto[];
  video?: SyndicationVideo;
};

type FxMetadata = {
  title: string | null;
  description: string | null;
  image: string | null;
  siteHandle: string | null;
};

type TwitterOEmbedResponse = {
  author_name?: string;
  author_url?: string;
  html?: string;
};

function isXArticlePath(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!/(^|\.)x\.com$|(^|\.)twitter\.com$/i.test(parsed.hostname)) {
      return false;
    }

    const path = parsed.pathname.toLowerCase();
    return /^\/i\/article(s)?\//.test(path);
  } catch {
    return false;
  }
}

async function resolveFinalUrl(initialUrl: string): Promise<string | null> {
  try {
    let current = initialUrl;

    for (let hop = 0; hop < 5; hop += 1) {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; XToWallabagReader/1.0; +https://vercel.com)",
          accept: "text/html,application/xhtml+xml,*/*",
        },
        cache: "no-store",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return null;
        }

        current = new URL(location, current).toString();
        continue;
      }

      return current;
    }

    return null;
  } catch {
    return null;
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function parseMaybeIsoDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function parseStatusId(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/\/status\/([0-9]+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function absolutizeUrl(src: string | undefined, baseUrl: string): string | null {
  if (!src) {
    return null;
  }

  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

function firstUrlFromSrcset(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const candidate = value
    .split(",")
    .map((entry) => entry.trim().split(/\s+/)[0])
    .find((entry) => entry && entry.length > 0);

  return candidate || undefined;
}

function resolveImageSourceFromElement(image: cheerio.Cheerio<AnyNode>, baseUrl: string): string | null {
  const candidate =
    image.attr("src") ||
    image.attr("data-src") ||
    image.attr("data-original") ||
    image.attr("data-lazy-src") ||
    firstUrlFromSrcset(image.attr("srcset")) ||
    firstUrlFromSrcset(image.attr("data-srcset"));

  return absolutizeUrl(candidate, baseUrl);
}

function isStatusSourceUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    const normalizedPath = parsed.pathname.toLowerCase();
    return /^\/[a-z0-9_]{1,20}\/status\/[0-9]+\/?$/.test(normalizedPath);
  } catch {
    return false;
  }
}

function normalizeStatusText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/https?:\/\/t\.co\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function deriveAuthorFromTitle(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*?)\s+on\s+(?:x|twitter)\s*:/i);
  const author = match?.[1]?.trim();
  return author && author.length > 0 ? author : null;
}

function deriveStatusTitle(statusText: string | null, fallbackTitle: string): string {
  if (!statusText) {
    return fallbackTitle;
  }

  const maxLength = 90;
  if (statusText.length <= maxLength) {
    return statusText;
  }

  return `${statusText.slice(0, maxLength - 1)}…`;
}

function getHtmlTextLength(value: string): number {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function linkifyEscapedText(escapedValue: string): string {
  return escapedValue.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="nofollow noopener noreferrer">${url}</a>`,
  );
}

function renderMarkdownInline(value: string): string {
  const tokenPrefix = "__WBX_MEDIA_TOKEN_";
  const tokenMap = new Map<string, string>();
  let tokenCount = 0;

  const createToken = (html: string): string => {
    const token = `${tokenPrefix}${tokenCount}__`;
    tokenMap.set(token, html);
    tokenCount += 1;
    return token;
  };

  // Linked image: [![alt](img)](link)
  let transformed = value.replace(
    /\[!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, altText: string, imageUrl: string, linkUrl: string) =>
      createToken(
        `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="nofollow noopener noreferrer"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText || "Image")}" /></a>`,
      ),
  );

  // Standalone image: ![alt](img)
  transformed = transformed.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi, (_, altText: string, imageUrl: string) =>
    createToken(`<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText || "Image")}" />`),
  );

  let escaped = escapeHtml(transformed).replace(/\n/g, "<br />");
  escaped = linkifyEscapedText(escaped);

  // Preserve basic inline markdown styling in readable extracts.
  escaped = escaped.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  escaped = escaped.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  escaped = escaped.replace(/(^|[\s(])\*([^*\n]+)\*(?=([\s).,!?:;]|$))/g, "$1<em>$2</em>");
  escaped = escaped.replace(/(^|[\s(])_([^_\n]+)_(?=([\s).,!?:;]|$))/g, "$1<em>$2</em>");

  for (const [token, html] of tokenMap.entries()) {
    escaped = escaped.replaceAll(token, html);
  }

  return escaped;
}

function linkifyText(value: string): string {
  const escaped = escapeHtml(value);
  return linkifyEscapedText(escaped);
}

function statusTextToHtml(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${linkifyText(block.replace(/\n/g, "<br />"))}</p>`)
    .join("");
}

function selectBestVideoVariant(video: SyndicationVideo | undefined): string | null {
  if (!video?.variants || video.variants.length === 0) {
    return null;
  }

  const mp4Variants = video.variants.filter((variant) => variant.type?.includes("mp4") && variant.src);
  if (mp4Variants.length === 0) {
    return null;
  }

  mp4Variants.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4Variants[0]?.src ?? null;
}

function buildSyndicationHtml(tweet: SyndicationTweet, sourceUrl: string): string {
  const chunks: string[] = [];

  const normalizedText = normalizeStatusText(tweet.text ?? null);
  if (normalizedText) {
    chunks.push(statusTextToHtml(normalizedText));
  }

  const photos = (tweet.photos ?? []).map((photo) => photo.url).filter((url): url is string => Boolean(url));
  for (const photoUrl of photos) {
    chunks.push(`<figure><img src="${escapeHtml(photoUrl)}" alt="Post image" /></figure>`);
  }

  const videoPoster = tweet.video?.poster;
  const videoSrc = selectBestVideoVariant(tweet.video);
  if (videoSrc) {
    const posterAttr = videoPoster ? ` poster="${escapeHtml(videoPoster)}"` : "";
    chunks.push(
      `<figure><video controls preload="metadata"${posterAttr}><source src="${escapeHtml(videoSrc)}" type="video/mp4" /></video></figure>`,
    );
  }

  chunks.push(
    `<p><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="nofollow noopener noreferrer">View original post on X</a></p>`,
  );

  return chunks.join("\n");
}

async function extractFromSyndication(sourceUrl: string): Promise<ExtractedArticle | null> {
  const statusId = parseStatusId(sourceUrl);
  if (!statusId) {
    return null;
  }

  try {
    const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${statusId}&lang=en`, {
      signal: AbortSignal.timeout(7000),
      headers: {
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const tweet = (await response.json()) as SyndicationTweet;
    const hasUsefulSignal = Boolean(
      normalizeStatusText(tweet.text ?? null) ||
        tweet.created_at ||
        tweet.user?.screen_name ||
        tweet.user?.name ||
        (tweet.photos && tweet.photos.length > 0) ||
        tweet.video,
    );

    if (!hasUsefulSignal) {
      return null;
    }

    const statusText = normalizeStatusText(tweet.text ?? null);
    const username = tweet.user?.screen_name ?? deriveStatusUsername(sourceUrl);
    const authorName = tweet.user?.name;
    const author = firstNonEmpty(authorName, username ? `@${username}` : null);
    const title = deriveStatusTitle(
      statusText,
      username ? `X status by @${username}` : "X status",
    );

    const coverImageUrl =
      firstNonEmpty(
        tweet.photos?.[0]?.url,
        tweet.video?.poster,
      ) ?? null;

    return {
      sourceUrl,
      title,
      author,
      publishedAt: parseMaybeIsoDate(tweet.created_at ?? null),
      coverImageUrl,
      rawHtml: buildSyndicationHtml(tweet, sourceUrl),
    };
  } catch {
    return null;
  }
}

async function extractFromFxMetadata(sourceUrl: string): Promise<FxMetadata | null> {
  try {
    const parsed = new URL(sourceUrl);
    const fxUrl = `https://fxtwitter.com${parsed.pathname}${parsed.search}`;

    const response = await fetch(fxUrl, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; XToWallabagReader/1.0; +https://vercel.com)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    return {
      title: firstNonEmpty($("meta[property='og:title']").attr("content"), $("meta[property='twitter:title']").attr("content")),
      description: normalizeStatusText(
        firstNonEmpty(
          $("meta[property='og:description']").attr("content"),
          $("meta[property='twitter:description']").attr("content"),
        ),
      ),
      image: firstNonEmpty($("meta[property='og:image']").attr("content"), $("meta[property='twitter:image']").attr("content")),
      siteHandle: firstNonEmpty($("meta[property='twitter:site']").attr("content"), $("meta[property='twitter:creator']").attr("content")),
    };
  } catch {
    return null;
  }
}

async function extractFromTwitterOEmbed(sourceUrl: string): Promise<ExtractedArticle | null> {
  try {
    const url = new URL("https://publish.twitter.com/oembed");
    url.searchParams.set("omit_script", "1");
    url.searchParams.set("dnt", "1");
    url.searchParams.set("url", sourceUrl);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(7000),
      headers: {
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as TwitterOEmbedResponse;
    const rawHtml = payload.html?.trim();

    if (!rawHtml) {
      return null;
    }

    const $ = cheerio.load(rawHtml);
    const blockquote = $("blockquote").first();
    const textFromEmbed = normalizeStatusText(blockquote.find("p").first().text());
    const dateText = blockquote.find("a").last().text().trim();

    const authorUrl = payload.author_url ?? "";
    const authorHandleMatch = authorUrl.match(/twitter\.com\/([a-z0-9_]{1,20})/i);
    const authorHandle = authorHandleMatch?.[1] ? `@${authorHandleMatch[1]}` : null;
    const author = firstNonEmpty(payload.author_name, authorHandle);
    const title = deriveStatusTitle(
      textFromEmbed,
      authorHandle ? `X status by ${authorHandle}` : payload.author_name ? `X status by ${payload.author_name}` : "X status",
    );

    return {
      sourceUrl,
      title,
      author,
      publishedAt: parseMaybeIsoDate(dateText || null),
      coverImageUrl: null,
      rawHtml,
    };
  } catch {
    return null;
  }
}

async function extractLinkedArticleFromStatus(sourceUrl: string): Promise<ExtractedArticle | null> {
  try {
    const url = new URL("https://publish.twitter.com/oembed");
    url.searchParams.set("omit_script", "1");
    url.searchParams.set("dnt", "1");
    url.searchParams.set("url", sourceUrl);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(7000),
      headers: {
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as TwitterOEmbedResponse;
    const rawHtml = payload.html?.trim();
    if (!rawHtml) {
      return null;
    }

    const $ = cheerio.load(rawHtml);
    const links = $("blockquote a")
      .map((_, node) => $(node).attr("href")?.trim() ?? "")
      .get()
      .filter((href) => href.length > 0);

    for (const link of links) {
      const resolved = await resolveFinalUrl(link);
      const targetUrl = resolved ?? link;

      if (!isXArticlePath(targetUrl)) {
        continue;
      }

      const extracted = await extractFromPage(targetUrl, sourceUrl);
      if (getHtmlTextLength(extracted.rawHtml) >= 160) {
        return extracted;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseFxReadableMarkdownPayload(payload: string): { title: string | null; markdown: string | null } {
  const titleMatch = payload.match(/^Title:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? null;

  const marker = "Markdown Content:";
  const markerIndex = payload.indexOf(marker);
  if (markerIndex === -1) {
    return { title, markdown: null };
  }

  const markdown = payload.slice(markerIndex + marker.length).trim();
  return {
    title,
    markdown: markdown.length > 0 ? markdown : null,
  };
}

function markdownToSafeHtml(markdown: string): string {
  const markdownProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype)
    .use(rehypeStringify);

  try {
    return String(markdownProcessor.processSync(markdown));
  } catch {
    const blocks = markdown
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter((block) => block.length > 0);

    return blocks.map((block) => `<p>${renderMarkdownInline(block)}</p>`).join("\n");
  }
}

function deriveAuthorFromFxReadableTitle(title: string | null): string | null {
  if (!title) {
    return null;
  }

  const match = title.match(/^(.*?)\s+on\s+x\s*:/i);
  const author = match?.[1]?.trim();
  return author && author.length > 0 ? author : null;
}

async function extractFromFxReadableStatus(sourceUrl: string): Promise<ExtractedArticle | null> {
  try {
    const parsed = new URL(sourceUrl);
    const readableUrl = `https://r.jina.ai/http://fxtwitter.com${parsed.pathname}${parsed.search}`;

    const response = await fetch(readableUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "text/plain,text/markdown,*/*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.text();
    const parsedPayload = parseFxReadableMarkdownPayload(payload);
    if (!parsedPayload.markdown) {
      return null;
    }

    if (parsedPayload.markdown.includes("This page is not supported.")) {
      return null;
    }

    const rawHtml = markdownToSafeHtml(parsedPayload.markdown);
    if (getHtmlTextLength(rawHtml) < 200) {
      return null;
    }

    const fallbackTitle = deriveStatusUsername(sourceUrl)
      ? `X status by @${deriveStatusUsername(sourceUrl)}`
      : "X status";

    return {
      sourceUrl,
      title: firstNonEmpty(parsedPayload.title, fallbackTitle) ?? fallbackTitle,
      author: deriveAuthorFromFxReadableTitle(parsedPayload.title),
      publishedAt: null,
      coverImageUrl: null,
      rawHtml,
    };
  } catch {
    return null;
  }
}

function buildStatusFallbackHtml(statusText: string | null, sourceUrl: string): string {
  const $ = cheerio.load("<article id='status-fallback'></article>");
  const article = $("#status-fallback");

  if (statusText) {
    const paragraph = $("<p></p>").text(statusText);
    article.append(paragraph);
  } else {
    const fallback = $("<p></p>").text(
      "This X status could not be extracted with full fidelity, but the original source is linked below.",
    );
    article.append(fallback);
  }

  const sourceLink = $("<a></a>")
    .attr("href", sourceUrl)
    .attr("target", "_blank")
    .attr("rel", "nofollow noopener noreferrer")
    .text("View original post on X");

  article.append($("<p></p>").append(sourceLink));

  return article.html() ?? "";
}

function deriveStatusUsername(sourceUrl: string): string | null {
  try {
    const parsed = new URL(sourceUrl);
    const match = parsed.pathname.match(/^\/([a-z0-9_]{1,20})\/status\//i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function extractXArticle(sourceUrl: string): Promise<ExtractedArticle> {
  if (isStatusSourceUrl(sourceUrl)) {
    const linkedArticleExtracted = await extractLinkedArticleFromStatus(sourceUrl);
    if (linkedArticleExtracted) {
      return linkedArticleExtracted;
    }

    const fxReadableExtracted = await extractFromFxReadableStatus(sourceUrl);
    if (fxReadableExtracted) {
      return fxReadableExtracted;
    }

    const syndicationExtracted = await extractFromSyndication(sourceUrl);
    if (syndicationExtracted) {
      return syndicationExtracted;
    }

    const oembedExtracted = await extractFromTwitterOEmbed(sourceUrl);
    if (oembedExtracted) {
      return oembedExtracted;
    }
  }

  return extractFromPage(sourceUrl, sourceUrl);
}

async function extractFromPage(fetchUrl: string, outputSourceUrl: string): Promise<ExtractedArticle> {
  const response = await fetch(fetchUrl, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; XToWallabagReader/1.0; +https://vercel.com)",
      accept: "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source URL (status ${response.status}).`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const isStatus = isStatusSourceUrl(fetchUrl);
  const fxMetadata = isStatus ? await extractFromFxMetadata(fetchUrl) : null;

  const ogTitle = $("meta[property='og:title']").attr("content");
  const twitterTitle = $("meta[name='twitter:title']").attr("content");
  const rawStatusDescription = firstNonEmpty(
    $("meta[property='og:description']").attr("content"),
    $("meta[name='twitter:description']").attr("content"),
    $("meta[name='description']").attr("content"),
  );
  const statusDescription = normalizeStatusText(rawStatusDescription);

  let title =
    firstNonEmpty(
      ogTitle,
      twitterTitle,
      $("title").first().text(),
      $("h1").first().text(),
    ) ?? "Untitled";

  if (isStatus) {
    const preferredStatusText = statusDescription ?? fxMetadata?.description ?? null;
    title = deriveStatusTitle(preferredStatusText, title);

    if (title.toLowerCase() === "untitled") {
      const username = deriveStatusUsername(fetchUrl);
      if (username) {
        title = `X status by @${username}`;
      }
    }

    if ((title.toLowerCase() === "untitled" || title.startsWith("X status by")) && fxMetadata?.title) {
      title = fxMetadata.title;
    }
  }

  const author =
    firstNonEmpty(
    $("meta[name='author']").attr("content"),
    $("meta[property='article:author']").attr("content"),
    $("[rel='author']").first().text(),
    fxMetadata?.siteHandle,
    ) ?? deriveAuthorFromTitle(firstNonEmpty(ogTitle, twitterTitle));

  const publishedAt = parseMaybeIsoDate(
    firstNonEmpty(
      $("meta[property='article:published_time']").attr("content"),
      $("meta[name='date']").attr("content"),
      $("time").first().attr("datetime"),
    ),
  );

  const coverImageUrl = absolutizeUrl(
    firstNonEmpty(
      $("meta[property='og:image']").attr("content"),
      $("meta[name='twitter:image']").attr("content"),
      fxMetadata?.image,
    ) ?? undefined,
    fetchUrl,
  );

  const articleNode =
    $("article").first().length > 0
      ? $("article").first()
      : $("main article").first().length > 0
        ? $("main article").first()
        : $("main").first().length > 0
          ? $("main").first()
          : $("body").first();

  articleNode.find(
    "script, style, noscript, iframe, nav, aside, footer, button, form, input, textarea, svg",
  ).remove();

  articleNode.find("picture").each((_, node) => {
    const picture = $(node);
    const img = picture.find("img").first();

    if (!img.length) {
      picture.remove();
      return;
    }

    const resolvedSrc = resolveImageSourceFromElement(img, fetchUrl);
    if (!resolvedSrc) {
      picture.remove();
      return;
    }

    img.attr("src", resolvedSrc);
    picture.replaceWith(img);
  });

  articleNode.find("img").each((_, node) => {
    const image = $(node);
    const absoluteSrc = resolveImageSourceFromElement(image, fetchUrl);

    if (!absoluteSrc) {
      image.remove();
      return;
    }

    image.attr("src", absoluteSrc);

    const srcset = image.attr("srcset");
    if (srcset) {
      const normalizedSrcset = srcset
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => {
          const url = entry.split(/\s+/)[0];
          return Boolean(absolutizeUrl(url, fetchUrl));
        })
        .join(", ");

      if (normalizedSrcset.length > 0) {
        image.attr("srcset", normalizedSrcset);
      } else {
        image.removeAttr("srcset");
      }
    }
  });

  let rawHtml = articleNode.html()?.trim() ?? "";

  const extractedTextLength = rawHtml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
  const effectiveStatusDescription = statusDescription ?? fxMetadata?.description ?? fxMetadata?.title ?? null;

  if (isStatus && !effectiveStatusDescription) {
    rawHtml = buildStatusFallbackHtml(null, outputSourceUrl);
  } else if (isStatus && effectiveStatusDescription && (title.toLowerCase() === "untitled" || extractedTextLength < 80)) {
    rawHtml = buildStatusFallbackHtml(effectiveStatusDescription, outputSourceUrl);
  } else if (isStatus && extractedTextLength < 200) {
    rawHtml = buildStatusFallbackHtml(effectiveStatusDescription, outputSourceUrl);
  }

  if (!rawHtml || rawHtml.trim().length === 0) {
    throw new Error("Could not extract article body from this page.");
  }

  // TODO: Add strategy fallback injection point for Playwright/external worker on hard pages.
  return {
    sourceUrl: outputSourceUrl,
    title,
    author,
    publishedAt,
    coverImageUrl,
    rawHtml,
  };
}
