import { headers } from "next/headers";
import crypto from "crypto";
import pool from "@/lib/db";

// Store request tokens temporarily
const validTokens = new Map<string, number>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, expiry] of validTokens.entries()) {
    if (expiry < now) {
      validTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

interface GymRow {
  id: string;
  name: string;
  team_id: number;
  lat: number;
  lon: number;
  url: string;
  description: string | null;
  available_slots: number | null;
  availble_slots: number | null;
  guarding_pokemon_id: number | null;
  updated: number;
  defenders: string | null;
  total_cp: number | null;
}

interface Defender {
  pokemon_id?: number;
  [key: string]: unknown;
}

interface Gym
  extends Omit<GymRow, "defenders" | "available_slots" | "availble_slots"> {
  defenders: Defender[];
  slots: number | null;
  last_updated?: string;
}

interface GymApiResult {
  mystic: Gym[];
  valor: Gym[];
  instinct: Gym[];
  counts: { mystic: number; valor: number; instinct: number };
}

export async function POST() {
  // This endpoint generates a one-time token for accessing the GET endpoint
  const headersList = await headers();

  // Verify this is coming from our app
  const internalSecret = headersList.get("x-internal-secret");
  if (internalSecret !== process.env.INTERNAL_API_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Generate a one-time token
  const token = crypto.randomBytes(32).toString("hex");
  const expiry = Date.now() + 30000;

  validTokens.set(token, expiry);

  return Response.json({ token, expiry });
}

// Helper function to format time since last update
function getTimeSinceUpdate(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export async function GET() {
  const headersList = await headers();

  // Method 1: Check if request is from a server component
  const isServerComponent =
    headersList.get("x-invoke-path") || headersList.get("x-middleware-invoke");

  if (!isServerComponent) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    // Get the geofence ID to filter gyms by
    const geofenceId = process.env.GEOFENCE_ID;
    const dbName = process.env.DB_NAME;
    const geofenceDbName = process.env.GEOFENCE_DB_NAME;

    // Time window for recent gyms (default: 1 hour = 3600 seconds)
    const timeWindow = process.env.GYM_TIME_WINDOW
      ? parseInt(process.env.GYM_TIME_WINDOW)
      : 3600;

    // geofence filtering and sorting by most recent
    const query = `
      SELECT
        g.id, g.name, g.team_id, g.lat, g.lon, g.url, g.description,
        g.available_slots, g.availble_slots, g.guarding_pokemon_id, g.updated,
        g.defenders, g.total_cp
      FROM ${dbName}.gym g
      WHERE g.updated > UNIX_TIMESTAMP() - ? 
        AND g.enabled = 1
        AND ST_CONTAINS(
          ST_GeomFromGeoJSON(
            (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
          ), 
          POINT(g.lon, g.lat)
        )
      ORDER BY g.updated DESC
    `;

    const [rows] = await pool.execute(query, [timeWindow, geofenceId]);

    const gymRows = rows as GymRow[];

    // Group gyms by team
    const result: GymApiResult = {
      mystic: [],
      valor: [],
      instinct: [],
      counts: { mystic: 0, valor: 0, instinct: 0 },
    };

    for (const gymRow of gymRows) {
      // Parse defenders JSON if present
      let defenders: Defender[] = [];
      try {
        defenders = gymRow.defenders ? JSON.parse(gymRow.defenders) : [];
      } catch {
        defenders = [];
      }

      // Create gym object
      const gym: Gym = {
        ...gymRow,
        defenders,
        slots: gymRow.available_slots ?? gymRow.availble_slots ?? null,
        last_updated: getTimeSinceUpdate(gymRow.updated),
      };

      // Add to appropriate team array
      if (gym.team_id === 1) {
        result.mystic.push(gym);
        result.counts.mystic += 1;
      } else if (gym.team_id === 2) {
        result.valor.push(gym);
        result.counts.valor += 1;
      } else if (gym.team_id === 3) {
        result.instinct.push(gym);
        result.counts.instinct += 1;
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("Database error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
  // No need to close connection - pool handles it automatically
}
