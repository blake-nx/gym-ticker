import { NextResponse } from "next/server";

import { fetchDefenderStats } from "@/server/gymData";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchDefenderStats();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Failed to load defender stats:", error);
    return NextResponse.json({ error: "Failed to load defender stats" }, { status: 500 });
  }
}
