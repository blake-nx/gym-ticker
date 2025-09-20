import pool from "@/lib/db";
import { TEAM_NAMES, getPokemonName } from "@/lib/pogoNames";

export interface Defender {
  pokemon_id?: number;
  form?: number;
  costume?: number;
  gender?: number;
  shiny?: boolean;
  cp_when_deployed?: number | string;
  times_fed?: number | string;
  motivation_now?: number | string;
  [key: string]: unknown;
}

export interface Gym {
  id: string;
  name: string;
  team_id: number;
  lat: number;
  lon: number;
  url: string;
  description: string | null;
  slots: number | null;
  guarding_pokemon_id: number | null;
  updated: number;
  defenders: Defender[];
  total_cp: number | null;
  last_updated?: string;
}

export interface GymApiResult {
  mystic: Gym[];
  valor: Gym[];
  instinct: Gym[];
  counts: { mystic: number; valor: number; instinct: number };
}

export interface ChartDataPoint {
  time: number;
  mystic: number;
  valor: number;
  instinct: number;
  total: number;
}

export interface ContestedGymChange {
  from: number | null;
  to: number | null;
  timestamp: number;
}

export interface ContestedGym {
  gym_id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  current_team: number;
  change_count: number;
  last_changed: number;
  recent_changes: ContestedGymChange[];
}

export interface GymHistoryResponse {
  period: string;
  chartData: ChartDataPoint[];
  contestedGyms: ContestedGym[];
  currentCounts: {
    mystic: number;
    valor: number;
    instinct: number;
    total: number;
  };
  lastUpdated: string;
}

export interface DefenderStats {
  pokemon_id: number;
  form?: number;
  count: number;
  total_cp: number;
  avg_cp: number;
  name?: string;
}

export interface TeamStats {
  team_name: string;
  team_id: number;
  total_defenders: number;
  unique_species: number;
  top_defenders: DefenderStats[];
  total_cp: number;
  avg_cp_per_defender: number;
}

export interface StatsData {
  teams: TeamStats[];
  overall: {
    total_defenders_all_teams: number;
    timestamp: string;
  };
}

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

interface HistoryRow {
  bucket: number;
  mystic: number | null;
  valor: number | null;
  instinct: number | null;
  total: number | null;
}

interface ContestedRow {
  gym_id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  current_team: number | null;
  change_count: number;
  last_changed: number;
}

interface ChangeRow {
  gym_id: string;
  old_team_id: number | null;
  new_team_id: number | null;
  changed_at: number;
}

interface TeamAggregation {
  defenders: Map<string, DefenderStats>;
  totalDefenders: number;
  totalCp: number;
}

type PeriodKey = "6h" | "12h" | "24h" | "48h" | "7d";

type PeriodConfig = {
  duration: number;
  bucket: number;
};

const PERIOD_CONFIG: Record<PeriodKey, PeriodConfig> = {
  "6h": { duration: 6 * 60 * 60, bucket: 5 * 60 },
  "12h": { duration: 12 * 60 * 60, bucket: 5 * 60 },
  "24h": { duration: 24 * 60 * 60, bucket: 5 * 60 },
  "48h": { duration: 48 * 60 * 60, bucket: 15 * 60 },
  "7d": { duration: 7 * 24 * 60 * 60, bucket: 60 * 60 },
};

const DEFAULT_GYM_RESULT: GymApiResult = {
  mystic: [],
  valor: [],
  instinct: [],
  counts: { mystic: 0, valor: 0, instinct: 0 },
};

const DEFAULT_STATS: StatsData = {
  teams: [],
  overall: {
    total_defenders_all_teams: 0,
    timestamp: new Date().toISOString(),
  },
};

function ensureIdentifier(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing configuration for ${label}`);
  }

  if (!/^\w+$/.test(value)) {
    throw new Error(`Invalid ${label} provided`);
  }

  return value;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function getTimeSinceUpdate(unixTimestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixTimestamp;

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function buildChartData(rows: HistoryRow[]): ChartDataPoint[] {
  return rows.map((row) => {
    const mystic = Math.round(row.mystic ?? 0);
    const valor = Math.round(row.valor ?? 0);
    const instinct = Math.round(row.instinct ?? 0);
    const recordedTotal = Math.round(row.total ?? 0);
    const controlledSum = mystic + valor + instinct;
    const total = Math.max(recordedTotal, controlledSum);

    return {
      time: row.bucket * 1000,
      mystic,
      valor,
      instinct,
      total,
    };
  });
}

function normalizeTeamId(teamId: number | null | undefined): number | null {
  if (teamId === null || teamId === undefined || teamId === 0) {
    return null;
  }

  return teamId;
}

function mapRecentChanges(rows: ChangeRow[]): Map<string, ContestedGymChange[]> {
  const grouped = new Map<string, ContestedGymChange[]>();

  for (const row of rows) {
    const fromTeam = normalizeTeamId(row.old_team_id);
    const toTeam = normalizeTeamId(row.new_team_id);

    if (fromTeam === toTeam) {
      continue;
    }

    let list = grouped.get(row.gym_id);
    if (!list) {
      list = [];
      grouped.set(row.gym_id, list);
    }

    if (list.length < 5) {
      list.push({
        from: fromTeam,
        to: toTeam,
        timestamp: row.changed_at * 1000,
      });
    }
  }

  return grouped;
}

export async function fetchGymSnapshot(): Promise<GymApiResult> {
  let geofenceId: string;
  let dbName: string;
  let geofenceDbName: string;

  try {
    geofenceId = ensureIdentifier(process.env.GEOFENCE_ID, "GEOFENCE_ID");
    dbName = ensureIdentifier(process.env.DB_NAME, "DB_NAME");
    geofenceDbName = ensureIdentifier(
      process.env.GEOFENCE_DB_NAME,
      "GEOFENCE_DB_NAME",
    );
  } catch (error) {
    console.error("Gym snapshot configuration error:", error);
    return DEFAULT_GYM_RESULT;
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
      } catch (parseError) {
        console.warn(
          `Failed to parse defenders for gym ${gymRow.id}:`,
          parseError,
        );
        defenders = [];
      }

      const slots =
        gymRow.available_slots ?? gymRow.availble_slots ?? null;

      const gym: Gym = {
        ...gymRow,
        defenders,
        slots,
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
    console.error("Error fetching gym snapshot:", error);
    return DEFAULT_GYM_RESULT;
  }
}

export async function fetchGymHistory(period: string): Promise<GymHistoryResponse> {
  const key: PeriodKey = (Object.keys(PERIOD_CONFIG) as PeriodKey[]).includes(
    period as PeriodKey,
  )
    ? (period as PeriodKey)
    : "24h";

  let dbName: string;
  let geofenceDbName: string;
  let geofenceId: string;

  try {
    dbName = ensureIdentifier(process.env.DB_NAME, "DB_NAME");
    geofenceDbName = ensureIdentifier(
      process.env.GEOFENCE_DB_NAME,
      "GEOFENCE_DB_NAME",
    );
    geofenceId = ensureIdentifier(process.env.GEOFENCE_ID, "GEOFENCE_ID");
  } catch (error) {
    console.error("Gym history configuration error:", error);
    return {
      period: key,
      chartData: [],
      contestedGyms: [],
      currentCounts: { mystic: 0, valor: 0, instinct: 0, total: 0 },
      lastUpdated: new Date(0).toISOString(),
    };
  }

  const { duration, bucket } = PERIOD_CONFIG[key];

  try {
    const [historyRows] = await pool.execute(
      `
      SELECT
        (FLOOR(timestamp / ?) * ?) AS bucket,
        AVG(team_mystic) AS mystic,
        AVG(team_valor) AS valor,
        AVG(team_instinct) AS instinct,
        AVG(total_gyms) AS total
      FROM gym_history
      WHERE timestamp >= UNIX_TIMESTAMP() - ?
      GROUP BY bucket
      ORDER BY bucket ASC
      `,
      [bucket, bucket, duration],
    );

    const chartData = buildChartData(historyRows as HistoryRow[]);

    const [latestRows] = await pool.execute(
      `
      SELECT team_mystic, team_valor, team_instinct, total_gyms, timestamp
      FROM gym_history
      ORDER BY timestamp DESC
      LIMIT 1
      `,
    );

    const latest = (latestRows as Array<{
      team_mystic: number;
      team_valor: number;
      team_instinct: number;
      total_gyms: number;
      timestamp: number;
    }>)[0];

    const currentCounts = latest
      ? (() => {
          const mystic = Math.round(latest.team_mystic ?? 0);
          const valor = Math.round(latest.team_valor ?? 0);
          const instinct = Math.round(latest.team_instinct ?? 0);
          const recordedTotal = Math.round(latest.total_gyms ?? 0);
          const controlledSum = mystic + valor + instinct;

          return {
            mystic,
            valor,
            instinct,
            total: Math.max(recordedTotal, controlledSum),
          };
        })()
      : { mystic: 0, valor: 0, instinct: 0, total: 0 };

    const lastUpdated = latest
      ? new Date(latest.timestamp * 1000).toISOString()
      : new Date(0).toISOString();

    const [contestedRows] = await pool.execute(
      `
      SELECT
        gtc.gym_id,
        g.name,
        g.lat,
        g.lon,
        g.url,
        g.team_id AS current_team,
        COUNT(gtc.id) AS change_count,
        MAX(gtc.changed_at) AS last_changed
      FROM gym_team_changes gtc
      JOIN ${dbName}.gym g ON gtc.gym_id = g.id
      WHERE gtc.changed_at >= UNIX_TIMESTAMP() - ?
        AND ST_CONTAINS(
          ST_GeomFromGeoJSON(
            (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
          ),
          POINT(g.lon, g.lat)
        )
      GROUP BY gtc.gym_id, g.name, g.lat, g.lon, g.url, g.team_id
      ORDER BY change_count DESC, last_changed DESC
      LIMIT 20
      `,
      [duration, geofenceId],
    );

    const contestedGyms = contestedRows as ContestedRow[];

    const gymIds = contestedGyms.map((row) => row.gym_id);
    let recentChangeMap = new Map<string, ContestedGymChange[]>();

    if (gymIds.length > 0) {
      const [recentRows] = await pool.execute(
        `
        SELECT gym_id, old_team_id, new_team_id, changed_at
        FROM gym_team_changes
        WHERE gym_id IN (${gymIds.map(() => "?").join(",")})
        ORDER BY changed_at DESC
        `,
        gymIds,
      );

      recentChangeMap = mapRecentChanges(recentRows as ChangeRow[]);
    }

    const contested: ContestedGym[] = contestedGyms.map((row) => ({
      gym_id: row.gym_id,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      url: row.url,
      current_team: row.current_team ?? 0,
      change_count: row.change_count,
      last_changed: row.last_changed * 1000,
      recent_changes: recentChangeMap.get(row.gym_id) ?? [],
    }));

    return {
      period: key,
      chartData,
      contestedGyms: contested,
      currentCounts,
      lastUpdated,
    };
  } catch (error) {
    console.error("Error fetching gym history:", error);
    return {
      period: key,
      chartData: [],
      contestedGyms: [],
      currentCounts: { mystic: 0, valor: 0, instinct: 0, total: 0 },
      lastUpdated: new Date(0).toISOString(),
    };
  }
}

export async function fetchDefenderStats(): Promise<StatsData> {
  let geofenceId: string;
  let geofenceDbName: string;
  let dbName: string;

  try {
    geofenceId = ensureIdentifier(process.env.GEOFENCE_ID, "GEOFENCE_ID");
    geofenceDbName = ensureIdentifier(
      process.env.GEOFENCE_DB_NAME,
      "GEOFENCE_DB_NAME",
    );
    dbName = ensureIdentifier(process.env.DB_NAME, "DB_NAME");
  } catch (error) {
    console.error("Defender stats configuration error:", error);
    return DEFAULT_STATS;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT g.team_id, g.defenders
       FROM ${dbName}.gym g
       WHERE g.enabled = 1
         AND g.team_id IN (1, 2, 3)
         AND ST_CONTAINS(
           ST_GeomFromGeoJSON(
             (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
           ),
           POINT(g.lon, g.lat)
         )`,
      [geofenceId],
    );

    const teamStats: Record<number, TeamAggregation> = {
      1: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
      2: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
      3: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
    };

    for (const row of rows as Array<{ team_id: number; defenders: string | null }>) {
      if (!row.defenders) continue;

      let parsedDefenders: unknown;
      try {
        parsedDefenders = JSON.parse(row.defenders);
      } catch (error) {
        console.warn("Failed to parse defenders JSON:", error);
        continue;
      }

      if (!Array.isArray(parsedDefenders)) {
        console.warn("Unexpected defenders payload shape", parsedDefenders);
        continue;
      }

      const defenders = parsedDefenders as Defender[];
      const team = teamStats[row.team_id];
      if (!team) continue;

      for (const defender of defenders) {
        if (!defender.pokemon_id) continue;

        const key = `${defender.pokemon_id}_${defender.form || 0}_${
          defender.costume || 0
        }`;
        const existing = team.defenders.get(key);
        const cp = toNumber(defender.cp_when_deployed);

        if (existing) {
          existing.count += 1;
          existing.total_cp += cp;
          existing.avg_cp = Math.round(existing.total_cp / Math.max(existing.count, 1));
        } else {
          team.defenders.set(key, {
            pokemon_id: defender.pokemon_id,
            form: defender.form,
            count: 1,
            total_cp: cp,
            avg_cp: cp,
            name: getPokemonName(defender.pokemon_id),
          });
        }

        team.totalDefenders += 1;
        team.totalCp += cp;
      }
    }

    const teams: TeamStats[] = [1, 2, 3].map((teamId) => {
      const team = teamStats[teamId];
      const defenders = Array.from(team.defenders.values()).sort(
        (a, b) => b.count - a.count,
      );

      return {
        team_name: TEAM_NAMES[teamId as keyof typeof TEAM_NAMES] ?? "Unknown",
        team_id: teamId,
        total_defenders: team.totalDefenders,
        unique_species: defenders.length,
        top_defenders: defenders.slice(0, 10),
        total_cp: team.totalCp,
        avg_cp_per_defender: team.totalDefenders
          ? Math.round(team.totalCp / team.totalDefenders)
          : 0,
      };
    });

    return {
      teams,
      overall: {
        total_defenders_all_teams: teams.reduce(
          (sum, team) => sum + team.total_defenders,
          0,
        ),
        timestamp: new Date().toISOString(),
      },
    } satisfies StatsData;
  } catch (error) {
    console.error("Error fetching defender stats:", error);
    return DEFAULT_STATS;
  }
}
