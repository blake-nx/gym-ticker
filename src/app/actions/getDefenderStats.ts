"use server";

import { fetchDefenderStats, type StatsData } from "@/server/gymData";

export async function getDefenderStatsAction(): Promise<StatsData> {
  return fetchDefenderStats();
}
