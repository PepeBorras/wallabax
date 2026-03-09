import * as cheerio from "cheerio";
import { type AnyNode, isTag } from "domhandler";

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
  "del",
  "a",
  "img",
  "figure",
  "figcaption",
  "pre",
  "code",
  "hr",
  "br",
  "time",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "div",
  "span",
]);

function promoteStrongParagraphHeadings(body$: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): void {
  root.find("p").each((_, paragraphNode) => {
    const paragraph = body$(paragraphNode);

    if (paragraph.closest("li, blockquote, td, th").length > 0) {
      return;
    }

    const elementChildren = paragraph.children();
    if (elementChildren.length !== 1) {
      return;
    }

    const onlyChild = elementChildren.first();
    const onlyChildTag = onlyChild.get(0)?.tagName?.toLowerCase();
    if (onlyChildTag !== "strong") {
      return;
    }

    const nonWhitespaceText = paragraph
      .contents()
      .filter((_, node) => node.type === "text" && (node.data ?? "").trim().length > 0);

    if (nonWhitespaceText.length > 0) {
      return;
    }

    const headingText = onlyChild.text().trim();
    if (!headingText || headingText.length > 90 || /[.!?]/.test(headingText)) {
      return;
    }

    paragraph.replaceWith(body$("<h2></h2>").text(headingText));
  });
}

function normalizeParagraphLists(body$: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): void {
  const listItemPattern = /^(?:([-*\u2022])\s+|(\d+)[.)]\s+)(.+)$/;

  root.find("p").each((_, paragraphNode) => {
    const paragraph = body$(paragraphNode);

    if (paragraph.attr("data-wbx-list-processed") === "1") {
      return;
    }

    if (paragraph.closest("li, blockquote, td, th").length > 0) {
      return;
    }

    const text = paragraph.text().trim();
    const match = text.match(listItemPattern);
    if (!match) {
      return;
    }

    const listType = match[2] ? "ol" : "ul";
    const list = body$(`<${listType}></${listType}>`);

    let current: cheerio.Cheerio<AnyNode> | undefined = paragraph;
    while (current && current.length > 0) {
      if (current.get(0)?.tagName?.toLowerCase() !== "p") {
        break;
      }

      const currentText = current.text().trim();
      const currentMatch = currentText.match(listItemPattern);
      if (!currentMatch) {
        break;
      }

      const currentType = currentMatch[2] ? "ol" : "ul";
      if (currentType !== listType) {
        break;
      }

      const itemText = currentMatch[3].trim();
      list.append(body$("<li></li>").text(itemText));
      current.attr("data-wbx-list-processed", "1");
      current = current.next();
    }

    paragraph.replaceWith(list);
  });

  root.find("p[data-wbx-list-processed='1']").remove();
}

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

function resolveImageSource(node: cheerio.Cheerio<AnyNode>): string | undefined {
  const directSrc = node.attr("src");
  const lazySrc = node.attr("data-src");
  const originalSrc = node.attr("data-original");
  const lazyOriginal = node.attr("data-lazy-src");
  const srcsetUrl = firstUrlFromSrcset(node.attr("srcset"));
  const dataSrcsetUrl = firstUrlFromSrcset(node.attr("data-srcset"));

  return directSrc || lazySrc || originalSrc || lazyOriginal || srcsetUrl || dataSrcsetUrl;
}

export function cleanArticleHtml(input: CleanArticleInput): string {
  const body$ = cheerio.load(input.rawHtml || "", undefined, false);
  const root = body$.root();

  root.find("script, style, noscript, iframe, nav, aside, footer, button, form").remove();

  // Convert picture/source wrappers into a simple image element to keep media in reader output.
  root.find("picture").each((_, pictureNode) => {
    const picture = body$(pictureNode);
    const img = picture.find("img").first();

    if (!img.length) {
      picture.remove();
      return;
    }

    const resolvedSrc = resolveImageSource(img);
    if (!resolvedSrc || !isSafeUrl(resolvedSrc)) {
      picture.remove();
      return;
    }

    img.attr("src", resolvedSrc);
    picture.replaceWith(img);
  });

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

    if (tagName === "img") {
      const resolvedSrc = resolveImageSource(node);
      if (!resolvedSrc || !isSafeUrl(resolvedSrc)) {
        node.remove();
        return;
      }

      node.attr("src", resolvedSrc);
    }

    Object.keys(attrs).forEach((attr) => {
      const lower = attr.toLowerCase();
      const keepHref = tagName === "a" && lower === "href";
      const keepSrc = tagName === "img" && lower === "src";
      const keepAlt = tagName === "img" && lower === "alt";
      const keepSrcSet = tagName === "img" && lower === "srcset";
      const keepDateTime = tagName === "time" && lower === "datetime";

      if (!keepHref && !keepSrc && !keepAlt && !keepSrcSet && !keepDateTime) {
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
      } else {
        const srcset = node.attr("srcset");
        if (srcset) {
          const normalizedSrcset = srcset
            .split(",")
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0 && isSafeUrl(entry.split(/\s+/)[0]))
            .join(", ");

          if (normalizedSrcset.length > 0) {
            node.attr("srcset", normalizedSrcset);
          } else {
            node.removeAttr("srcset");
          }
        }
      }
    }
  });

  promoteStrongParagraphHeadings(body$, root);
  normalizeParagraphLists(body$, root);

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
