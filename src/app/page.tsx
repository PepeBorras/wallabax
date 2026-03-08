import { HomeShell } from "@/components/home/home-shell";
import { getDailyGenerationLimitState, purgeExpiredArticles } from "@/lib/services/article-retention";

export default async function HomePage() {
  await purgeExpiredArticles();
  const limits = await getDailyGenerationLimitState();

  return <HomeShell initialLimits={limits} />;
}
