import { NextRequest, NextResponse } from "next/server";

import { fetchGymHistory } from "@/server/gymData";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") ?? "24h";

  try {
    const data = await fetchGymHistory(period);
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Failed to load gym history:", error);
    return NextResponse.json({ error: "Failed to load gym history" }, { status: 500 });
  }
}
