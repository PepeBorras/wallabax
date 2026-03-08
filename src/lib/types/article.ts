export type ArticleRecord = {
  id: string;
  source_url: string;
  slug: string | null;
  title: string;
  author: string | null;
  published_at: string | null;
  cover_image_url: string | null;
  cleaned_html: string;
  created_at: string;
  updated_at: string;
};

export type ExtractedArticle = {
  sourceUrl: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  rawHtml: string;
};

export type CleanArticleInput = {
  title: string;
  author: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  rawHtml: string;
};

export type SaveArticleInput = {
  sourceUrl: string;
  title: string;
  author: string | null;
  publishedAt: string | null;
  coverImageUrl: string | null;
  cleanedHtml: string;
};
