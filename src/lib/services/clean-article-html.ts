import * as cheerio from "cheerio";
import { isTag } from "domhandler";

import type { CleanArticleInput } from "@/lib/types/article";

const ALLOWED_TAGS = new Set([
  "article",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "strong",
  "em",
  "a",
  "img",
  "figure",
  "figcaption",
  "pre",
  "code",
  "hr",
  "br",
  "time",
  "div",
  "span",
]);

function toSafeText(value: string | null): string {
  return value?.trim() ?? "";
}

function isSafeUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("http://") || normalized.startsWith("https://");
}

export function cleanArticleHtml(input: CleanArticleInput): string {
  const body$ = cheerio.load(input.rawHtml || "", undefined, false);
  const root = body$.root();

  root.find("script, style, noscript, iframe, nav, aside, footer, button, form").remove();

  root.find("*").each((_, element) => {
    if (!isTag(element)) {
      return;
    }

    const node = body$(element);
    const tagName = element.tagName.toLowerCase();

    if (tagName === "html" || tagName === "head" || tagName === "body") {
      return;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      node.replaceWith(node.text());
      return;
    }

    const attrs = element.attribs || {};
    Object.keys(attrs).forEach((attr) => {
      const lower = attr.toLowerCase();
      const keepHref = tagName === "a" && lower === "href";
      const keepSrc = tagName === "img" && lower === "src";
      const keepAlt = tagName === "img" && lower === "alt";
      const keepDateTime = tagName === "time" && lower === "datetime";

      if (!keepHref && !keepSrc && !keepAlt && !keepDateTime) {
        node.removeAttr(attr);
      }
    });

    if (tagName === "a") {
      const href = node.attr("href");
      if (!isSafeUrl(href)) {
        node.removeAttr("href");
      }

      node.attr("rel", "nofollow noopener noreferrer");
      node.attr("target", "_blank");
    }

    if (tagName === "img") {
      const src = node.attr("src");
      if (!isSafeUrl(src)) {
        node.remove();
      }
    }
  });

  const cleanedBody = root.html()?.trim();
  const plainTextFallback = root
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const out$ = cheerio.load("<article id='reader-article'></article>");
  const article = out$("#reader-article");

  const titleNode = out$("<h1></h1>").text(toSafeText(input.title));
  article.append(titleNode);

  if (input.author || input.publishedAt) {
    const metaNode = out$("<p></p>");

    if (input.author) {
      const authorNode = out$("<span></span>").text(`By ${toSafeText(input.author)}`);
      metaNode.append(authorNode);
    }

    if (input.publishedAt) {
      if (input.author) {
        const separatorNode = out$("<span></span>").text(" • ");
        metaNode.append(separatorNode);
      }

      const timeNode = out$("<time></time>")
        .attr("datetime", toSafeText(input.publishedAt))
        .text(toSafeText(input.publishedAt));
      metaNode.append(timeNode);
    }

    article.append(metaNode);
  }

  if (input.coverImageUrl && isSafeUrl(input.coverImageUrl)) {
    const img = out$("<img />").attr("src", toSafeText(input.coverImageUrl)).attr("alt", toSafeText(input.title));
    const figure = out$("<figure></figure>").append(img);
    article.append(figure);
  }

  if (cleanedBody && cleanedBody.length > 0) {
    article.append(cleanedBody);
  } else if (plainTextFallback.length > 0) {
    const fallbackParagraph = out$("<p></p>").text(plainTextFallback);
    article.append(fallbackParagraph);
  } else {
    const defaultFallback = out$("<p></p>").text(
      "Content could not be cleanly extracted from the source page. Use the original source link for full context.",
    );
    article.append(defaultFallback);
  }

  return out$.html() ?? "";
}
