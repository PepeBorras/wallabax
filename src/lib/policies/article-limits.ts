export const DAILY_LINK_GENERATION_LIMIT = 100;
export const ARTICLE_TTL_HOURS = 24;

type DailyLimitState = {
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
  ttlHours: number;
};

function toIso(date: Date): string {
  return date.toISOString();
}

export function getUtcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function getNextUtcDayStart(now = new Date()): Date {
  const dayStart = getUtcDayStart(now);
  dayStart.setUTCDate(dayStart.getUTCDate() + 1);
  return dayStart;
}

export function getUtcDayStartIso(now = new Date()): string {
  return toIso(getUtcDayStart(now));
}

export function getNextUtcDayStartIso(now = new Date()): string {
  return toIso(getNextUtcDayStart(now));
}

export function getArticleExpiryCutoffIso(now = new Date()): string {
  return toIso(new Date(now.getTime() - ARTICLE_TTL_HOURS * 60 * 60 * 1000));
}

export function buildDailyLimitState(usedCount: number): DailyLimitState {
  const used = Math.max(0, usedCount);
  return {
    limit: DAILY_LINK_GENERATION_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LINK_GENERATION_LIMIT - used),
    resetsAt: getNextUtcDayStartIso(),
    ttlHours: ARTICLE_TTL_HOURS,
  };
}

export type { DailyLimitState };
