"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  getPokemonSprite,
  handlePokemonImageError,
} from "@/utils/pokemonIcons";
import { ViewMapLink } from "./ViewMapLink";

interface DefenderStats {
  id?: number;
  pokemon_id: number;
  form?: number;
  count: number;
  total_cp: number;
  avg_cp: number;
  name?: string;
}

interface TeamStats {
  team_name: string;
  team_id: number;
  total_defenders: number;
  unique_species: number;
  top_defenders: DefenderStats[];
  total_cp: number;
  avg_cp_per_defender: number;
}

interface StatsData {
  teams: TeamStats[];
  overall: {
    total_defenders_all_teams: number;
    timestamp: string;
  };
}

export default function DefenderStats({
  getStatsAction,
}: {
  getStatsAction: () => Promise<StatsData>;
}) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setError(null);
        const data = await getStatsAction();
        setStats(data);
      } catch (error) {
        console.error("Failed to load defender stats:", error);
        setError("Failed to load defender statistics");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [getStatsAction]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6">
        <div className="text-red-400 text-center">{error}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6">
        <div className="text-gray-400 text-center">No data available</div>
      </div>
    );
  }

  const teamColors = {
    1: {
      bg: "bg-blue-900/50",
      text: "text-blue-400",
      border: "border-blue-500",
    },
    2: { bg: "bg-red-900/50", text: "text-red-400", border: "border-red-500" },
    3: {
      bg: "bg-yellow-900/50",
      text: "text-yellow-400",
      border: "border-yellow-500",
    },
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 mt-8">
      {/* Overall Stats */}
      <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <h2 className="text-2xl font-bold text-white text-center sm:text-left">
            Gym Defender Statistics
          </h2>
          <ViewMapLink />
        </div>

        <div className="text-center text-sm text-gray-500">
          Total defenders across all teams:{" "}
          {stats.overall.total_defenders_all_teams}
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.teams.map((team) => {
          const colors = teamColors[team.team_id as keyof typeof teamColors];
          return (
            <div
              key={team.team_id}
              className={`${colors.bg} border ${colors.border} rounded-2xl p-6`}
            >
              <h3
                className={`text-xl font-bold ${colors.text} mb-4 text-center`}
              >
                Team {team.team_name}
              </h3>

              <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Total Defenders:</span>
                    <div className="font-bold text-white">
                      {team.total_defenders}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Unique Species:</span>
                    <div className="font-bold text-white">
                      {team.unique_species}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Total CP:</span>
                    <div className="font-bold text-white">
                      {team.total_cp.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg CP:</span>
                    <div className="font-bold text-white">
                      {team.avg_cp_per_defender}
                    </div>
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-white mb-2">
                Top 10 Favorites
              </h4>
              <div className="space-y-2">
                {team.top_defenders.slice(0, 10).map((defender, idx) => (
                  <div
                    key={`team_${team.team_id}_${idx}_${defender.pokemon_id}_${
                      defender.form || 0
                    }`}
                    className="flex items-center gap-2 bg-gray-800/30 rounded-lg p-2"
                  >
                    <span className="text-lg font-bold text-gray-600">
                      #{idx + 1}
                    </span>
                    <Image
                      src={getPokemonSprite(defender.pokemon_id)}
                      alt={defender.name || `Pokemon ${defender.pokemon_id}`}
                      width={32}
                      height={32}
                      onError={(e) =>
                        handlePokemonImageError(e, defender.pokemon_id)
                      }
                      unoptimized
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {defender.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {defender.count}x • CP: {defender.avg_cp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
