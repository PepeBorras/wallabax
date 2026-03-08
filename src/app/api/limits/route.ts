import { NextResponse } from "next/server";

import { getDailyGenerationLimitState, purgeExpiredArticles } from "@/lib/services/article-retention";

export async function GET() {
  try {
    await purgeExpiredArticles();
    const limits = await getDailyGenerationLimitState();

    return NextResponse.json({ limits });
  } catch (error) {
    console.error("GET /api/limits failed", error);
    return NextResponse.json({ error: "Could not load generation limits right now." }, { status: 500 });
  }
}
