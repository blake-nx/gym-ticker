import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { fetchGymSnapshot } from "@/server/gymData";

export const dynamic = "force-dynamic";

const TOKEN_TTL_MS = 60_000;
const tokenStore = new Map<string, number>();

function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, expiresAt] of tokenStore.entries()) {
    if (expiresAt <= now) {
      tokenStore.delete(token);
    }
  }
}

function createToken() {
  const token = crypto.randomBytes(24).toString("hex");
  tokenStore.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function validateToken(token: string | null): boolean {
  if (!token) return false;
  cleanupExpiredTokens();
  const expiresAt = tokenStore.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    tokenStore.delete(token);
    return false;
  }
  return true;
}

export async function GET(request: NextRequest) {
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const requireToken = Boolean(internalSecret);
  const hasInternalHeader = Boolean(request.headers.get("x-invoke-path"));

  if (!hasInternalHeader && requireToken) {
    const token = request.headers.get("x-access-token");
    if (!validateToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const snapshot = await fetchGymSnapshot();
    return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Failed to load gym snapshot:", error);
    return NextResponse.json({ error: "Failed to load gyms" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured" },
      { status: 400 },
    );
  }

  const providedSecret = request.headers.get("x-internal-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = createToken();
  return NextResponse.json({ token, expiresIn: TOKEN_TTL_MS / 1000 });
}
