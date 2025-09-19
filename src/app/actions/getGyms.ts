"use server";

import pool from "@/lib/db";

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

export interface Defender {
  pokemon_id?: number;
  [key: string]: unknown;
}

export interface Gym
  extends Omit<GymRow, "defenders" | "available_slots" | "availble_slots"> {
  defenders: Defender[];
  slots: number | null;
  last_updated?: string;
}

export interface GymApiResult {
  mystic: Gym[];
  valor: Gym[];
  instinct: Gym[];
  counts: { mystic: number; valor: number; instinct: number };
}

const EMPTY_RESULT: GymApiResult = {
  mystic: [],
  valor: [],
  instinct: [],
  counts: { mystic: 0, valor: 0, instinct: 0 },
};

function getTimeSinceUpdate(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export async function getGymsAction(): Promise<GymApiResult> {
  const geofenceId = process.env.GEOFENCE_ID;
  const dbName = process.env.DB_NAME;
  const geofenceDbName = process.env.GEOFENCE_DB_NAME;

  if (!geofenceId || !dbName || !geofenceDbName) {
    console.error("Missing database configuration for getGymsAction");
    return EMPTY_RESULT;
  }

  const timeWindow = parseInt(process.env.GYM_TIME_WINDOW ?? "3600", 10);

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

  try {
    const [rows] = await pool.execute(query, [timeWindow, geofenceId]);
    const gymRows = rows as GymRow[];

    const result: GymApiResult = {
      mystic: [],
      valor: [],
      instinct: [],
      counts: { mystic: 0, valor: 0, instinct: 0 },
    };

    for (const gymRow of gymRows) {
      let defenders: Defender[] = [];

      try {
        defenders = gymRow.defenders ? JSON.parse(gymRow.defenders) : [];
      } catch {
        defenders = [];
      }

      const gym: Gym = {
        ...gymRow,
        defenders,
        slots: gymRow.available_slots ?? gymRow.availble_slots ?? null,
        last_updated: getTimeSinceUpdate(gymRow.updated),
      };

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

    return result;
  } catch (error) {
    console.error("getGymsAction database error:", error);
    return EMPTY_RESULT;
  }
}
