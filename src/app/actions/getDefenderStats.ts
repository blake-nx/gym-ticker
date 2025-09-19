"use server";

import pool from "@/lib/db";
import { TEAM_NAMES, getPokemonName } from "@/lib/pogoNames";

interface DefenderData {
  pokemon_id: number;
  form?: number;
  gender?: number;
  cp_when_deployed: number;
  deployed_time: number;
  motivation_now: number;
  times_fed?: number;
}

export interface DefenderStats {
  pokemon_id: number;
  form?: number;
  count: number;
  total_cp: number;
  avg_cp: number;
  name?: string;
  total_times_fed?: number;
  avg_times_fed?: number;
  max_times_fed?: number;
  gym_name?: string;
  team_id?: number;
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
    most_popular_overall: DefenderStats[];
    most_fed_overall: DefenderStats[];
    strongest_defenders: DefenderStats[];
    timestamp: string;
  };
}

const EMPTY_STATS: StatsData = {
  teams: [],
  overall: {
    total_defenders_all_teams: 0,
    most_popular_overall: [],
    most_fed_overall: [],
    strongest_defenders: [],
    timestamp: new Date().toISOString(),
  },
};

interface MostFedRow {
  gym_name: string;
  team_id: string;
  pokemon_id: string;
  form: string | null;
  times_fed: string;
  cp: string;
}

async function getMostFedDefenders(
  dbName: string,
  geofenceDbName: string,
  geofenceId: string
): Promise<DefenderStats[]> {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        g.name as gym_name,
        g.team_id,
        JSON_UNQUOTE(JSON_EXTRACT(defender.value, '$.pokemon_id')) as pokemon_id,
        JSON_UNQUOTE(JSON_EXTRACT(defender.value, '$.form')) as form,
        JSON_UNQUOTE(JSON_EXTRACT(defender.value, '$.times_fed')) as times_fed,
        JSON_UNQUOTE(JSON_EXTRACT(defender.value, '$.cp_when_deployed')) as cp
      FROM ${dbName}.gym g
      CROSS JOIN JSON_TABLE(
        g.defenders,
        '$[*]' COLUMNS ( value JSON PATH '$' )
      ) AS defender
      WHERE g.enabled = 1
        AND g.team_id IN (1, 2, 3)
        AND JSON_EXTRACT(defender.value, '$.times_fed') IS NOT NULL
        AND JSON_EXTRACT(defender.value, '$.times_fed') > 0
        AND ST_CONTAINS(
          ST_GeomFromGeoJSON(
            (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
          ),
          POINT(g.lon, g.lat)
        )
      ORDER BY CAST(JSON_EXTRACT(defender.value, '$.times_fed') AS UNSIGNED) DESC
      LIMIT 10
      `,
      [geofenceId]
    );

    return (rows as MostFedRow[]).map((row) => {
      const pokemonId = parseInt(row.pokemon_id, 10);

      return {
        pokemon_id: pokemonId,
        form: row.form ? parseInt(row.form, 10) : undefined,
        count: 1,
        total_cp: parseInt(row.cp, 10) || 0,
        avg_cp: parseInt(row.cp, 10) || 0,
        name: getPokemonName(pokemonId),
        total_times_fed: parseInt(row.times_fed, 10) || 0,
        avg_times_fed: parseInt(row.times_fed, 10) || 0,
        max_times_fed: parseInt(row.times_fed, 10) || 0,
        gym_name: row.gym_name,
        team_id: parseInt(row.team_id, 10) || 0,
      } satisfies DefenderStats;
    });
  } catch (error) {
    console.error("Error getting most fed defenders:", error);
    return [];
  }
}

function getMostPopularOverall(
  teamStats: Record<
    number,
    {
      defenders: Map<string, DefenderStats>;
      totalDefenders: number;
      totalCp: number;
    }
  >
) {
  const allDefenders = new Map<string, DefenderStats>();

  for (const team of Object.values(teamStats)) {
    for (const [key, defender] of team.defenders) {
      const existing = allDefenders.get(key);
      if (existing) {
        existing.count += defender.count;
        existing.total_cp += defender.total_cp;
        existing.avg_cp = Math.round(existing.total_cp / existing.count);
        existing.total_times_fed =
          (existing.total_times_fed || 0) + (defender.total_times_fed || 0);
        existing.max_times_fed = Math.max(
          existing.max_times_fed || 0,
          defender.max_times_fed || 0
        );
      } else {
        allDefenders.set(key, { ...defender });
      }
    }
  }

  return Array.from(allDefenders.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getDefenderStatsAction(): Promise<StatsData> {
  const geofenceId = process.env.GEOFENCE_ID;
  const geofenceDbName = process.env.GEOFENCE_DB_NAME;
  const dbName = process.env.DB_NAME;

  if (!geofenceId || !geofenceDbName || !dbName) {
    console.error("Missing database configuration for getDefenderStatsAction");
    return EMPTY_STATS;
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
      [geofenceId]
    );

    const teamStats: Record<
      number,
      {
        defenders: Map<string, DefenderStats>;
        totalDefenders: number;
        totalCp: number;
      }
    > = {
      1: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
      2: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
      3: { defenders: new Map(), totalDefenders: 0, totalCp: 0 },
    };

    for (const gym of rows as Array<{
      team_id: number;
      defenders: string | null;
    }>) {
      if (!gym.defenders || gym.defenders === "null" || gym.defenders === "[]") {
        continue;
      }

      try {
        if (typeof gym.defenders !== "string" || gym.defenders.trim() === "") {
          continue;
        }

        const defenders = JSON.parse(gym.defenders) as DefenderData[];
        if (!Array.isArray(defenders)) {
          console.error("Defenders is not an array:", gym.defenders);
          continue;
        }

        for (const defender of defenders) {
          if (
            !defender ||
            typeof defender.pokemon_id !== "number" ||
            !defender.cp_when_deployed
          ) {
            continue;
          }

          const teamId = gym.team_id;
          const pokemonKey = `${defender.pokemon_id}_${defender.form || 0}`;

          teamStats[teamId].totalDefenders += 1;
          teamStats[teamId].totalCp += defender.cp_when_deployed;

          const existing = teamStats[teamId].defenders.get(pokemonKey);
          if (existing) {
            existing.count += 1;
            existing.total_cp += defender.cp_when_deployed;
            existing.avg_cp = Math.round(existing.total_cp / existing.count);
            existing.total_times_fed =
              (existing.total_times_fed || 0) + (defender.times_fed || 0);
            existing.avg_times_fed = Math.round(
              (existing.total_times_fed || 0) / existing.count
            );
            existing.max_times_fed = Math.max(
              existing.max_times_fed || 0,
              defender.times_fed || 0
            );
          } else {
            teamStats[teamId].defenders.set(pokemonKey, {
              pokemon_id: defender.pokemon_id,
              form: defender.form,
              count: 1,
              total_cp: defender.cp_when_deployed,
              avg_cp: defender.cp_when_deployed,
              name: getPokemonName(defender.pokemon_id),
              total_times_fed: defender.times_fed || 0,
              avg_times_fed: defender.times_fed || 0,
              max_times_fed: defender.times_fed || 0,
            });
          }
        }
      } catch (error) {
        console.error("Error parsing defenders for gym:", error);
      }
    }

    const results: TeamStats[] = [];
    for (const [teamId, stats] of Object.entries(teamStats)) {
      const teamIdNum = parseInt(teamId, 10);
      const topDefenders = Array.from(stats.defenders.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      results.push({
        team_name: TEAM_NAMES[teamIdNum],
        team_id: teamIdNum,
        total_defenders: stats.totalDefenders,
        unique_species: stats.defenders.size,
        top_defenders: topDefenders,
        total_cp: stats.totalCp,
        avg_cp_per_defender:
          stats.totalDefenders > 0
            ? Math.round(stats.totalCp / stats.totalDefenders)
            : 0,
      });
    }

    results.sort((a, b) => a.team_id - b.team_id);

    const mostFedDefenders = await getMostFedDefenders(
      dbName,
      geofenceDbName,
      geofenceId
    );

    const serializedMostFed = mostFedDefenders.map((defender) => ({
      pokemon_id: defender.pokemon_id,
      form: defender.form,
      count: defender.count,
      total_cp: defender.total_cp,
      avg_cp: defender.avg_cp,
      name: defender.name,
      total_times_fed: defender.total_times_fed,
      avg_times_fed: defender.avg_times_fed,
      max_times_fed: defender.max_times_fed,
      gym_name: defender.gym_name,
      team_id: defender.team_id,
    }));

    const overallStats = {
      total_defenders_all_teams: results.reduce(
        (sum, team) => sum + team.total_defenders,
        0
      ),
      most_popular_overall: getMostPopularOverall(teamStats),
      most_fed_overall: serializedMostFed,
      strongest_defenders: [],
      timestamp: new Date().toISOString(),
    };

    return {
      teams: results,
      overall: overallStats,
    } satisfies StatsData;
  } catch (error) {
    console.error("getDefenderStatsAction database error:", error);
    return EMPTY_STATS;
  }
}
