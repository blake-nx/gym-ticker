"use client";
import { useCallback } from "react";
import Image from "next/image";
import { TickerCount } from "./TickerCount";
import { ViewMapLink } from "./ViewMapLink";
import {
  getPokemonSprite,
  handlePokemonImageError,
} from "@/utils/pokemonIcons";
import type { Gym, GymApiResult } from "@/server/gymData";
import { resolveGymImage } from "@/utils/gymImages";

interface GymTickerProps {
  gyms: GymApiResult;
  isPending: boolean;
  updateError: boolean;
  isClient: boolean;
}

export default function GymTicker({
  gyms,
  isPending,
  updateError,
  isClient,
}: GymTickerProps) {
  // Calculate favorite defender for each team
  const getFavoriteDefender = useCallback((teamGyms: Gym[]) => {
    const defenderCounts = new Map<
      string,
      {
        pokemon_id: number;
        form?: number;
        costume?: number;
        count: number;
      }
    >();

    teamGyms.forEach((gym) => {
      gym.defenders?.forEach((defender) => {
        if (defender.pokemon_id) {
          const key = `${defender.pokemon_id}_${defender.form || 0}_${
            defender.costume || 0
          }`;
          const existing = defenderCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            defenderCounts.set(key, {
              pokemon_id: defender.pokemon_id,
              form: defender.form,
              costume: defender.costume,
              count: 1,
            });
          }
        }
      });
    });

    // Find the most common defender
    let favorite = null;
    let maxCount = 0;
    for (const defender of defenderCounts.values()) {
      if (defender.count > maxCount) {
        maxCount = defender.count;
        favorite = defender;
      }
    }

    return favorite;
  }, []);

  // Calculate time ago for display
  const getTimeAgo = useCallback(
    (timestamp: number) => {
      if (!isClient) return "...";

      const now = Math.floor(Date.now() / 1000);
      const diff = now - timestamp;

      if (diff < 60) return "just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    },
    [isClient]
  );

  const renderGyms = (teamGyms: Gym[], color: string) => (
    <div className="w-full mt-4 flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      {teamGyms.length === 0 ? (
        <div className="text-gray-400 text-center italic py-8">
          No gyms controlled
        </div>
      ) : (
        teamGyms.map((gym) => (
          <div
            key={gym.id}
            className="flex items-center bg-gray-700/50 hover:bg-gray-700/70 transition-colors rounded-lg p-3 gap-3"
          >
            <div className="relative">
              <Image
                src={resolveGymImage(gym.url)}
                alt={gym.name || "Gym"}
                width={56}
                height={56}
                className="rounded-lg bg-gray-800 object-cover"
                unoptimized
              />
              {gym.slots === 0 && (
                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-1 rounded">
                  FULL
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className={`font-bold truncate ${color} text-lg`}>
                {gym.name || "Unknown Gym"}
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-300 mt-1">
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  {gym.defenders?.length ?? 0}/6
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {gym.total_cp ?? "?"}
                </span>
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {getTimeAgo(gym.updated)}
                </span>
              </div>

              {gym.description && (
                <div className="text-xs text-gray-400 mt-1 line-clamp-1">
                  {gym.description}
                </div>
              )}
            </div>

            {/* Defender preview */}
            {gym.defenders && gym.defenders.length > 0 && (
              <div className="flex -space-x-2">
                {gym.defenders
                  .slice(0, 3)
                  .map(
                    (defender, idx) =>
                      defender.pokemon_id && (
                        <Image
                          key={idx}
                          src={getPokemonSprite(defender.pokemon_id)}
                          alt="Defender"
                          width={32}
                          height={32}
                          className="rounded-full bg-gray-700 border-2 border-gray-800"
                          onError={(e) =>
                            handlePokemonImageError(
                              e,
                              defender.pokemon_id!,
                              defender.form
                            )
                          }
                          unoptimized
                        />
                      )
                  )}
                {gym.defenders.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center text-xs text-gray-300">
                    +{gym.defenders.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center">
      {/* Status indicators */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        {isPending && (
          <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm animate-pulse">
            Updating...
          </div>
        )}
        {updateError && isClient && (
          <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm">
            Update failed
          </div>
        )}
      </div>

      <div className="w-full max-w-7xl px-4 py-8">
        <div className="flex justify-end mb-4">
          <ViewMapLink className="text-base" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Valor */}
          <div className="bg-gradient-to-br from-red-900/20 to-gray-800/50 border border-red-800/50 flex flex-col items-center rounded-2xl p-6 shadow-xl">
            <Image
              src="/images/valor.png"
              alt="Valor"
              width={160}
              height={160}
              className="mb-4 drop-shadow-2xl"
              priority
            />
            <TickerCount value={gyms.counts.valor} colorClass="text-red-500" />
            <span className="text-xl font-bold text-red-400 mb-2">
              Team Valor
            </span>

            {/* Favorite Defender */}
            {(() => {
              const favorite = getFavoriteDefender(gyms.valor);
              return favorite ? (
                <div className="flex items-center gap-2 mb-3 bg-gray-800/50 rounded-lg px-3 py-2">
                  <Image
                    src={getPokemonSprite(favorite.pokemon_id)}
                    alt="Favorite Defender"
                    width={40}
                    height={40}
                    onError={(e) =>
                      handlePokemonImageError(e, favorite.pokemon_id)
                    }
                    unoptimized
                  />
                  <div className="text-sm">
                    <div className="text-gray-400 text-xs">
                      Favorite Defender
                    </div>
                    <div className="text-red-300 font-medium">
                      #{favorite.pokemon_id}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {renderGyms(gyms.valor, "text-red-300")}
          </div>

          {/* Instinct */}
          <div className="bg-gradient-to-br from-yellow-900/20 to-gray-800/50 border border-yellow-800/50 flex flex-col items-center rounded-2xl p-6 shadow-xl">
            <Image
              src="/images/instinct.png"
              alt="Instinct"
              width={160}
              height={160}
              className="mb-4 drop-shadow-2xl"
              priority
            />
            <TickerCount
              value={gyms.counts.instinct}
              colorClass="text-yellow-500"
            />
            <span className="text-xl font-bold text-yellow-400 mb-2">
              Team Instinct
            </span>

            {/* Favorite Defender */}
            {(() => {
              const favorite = getFavoriteDefender(gyms.instinct);
              return favorite ? (
                <div className="flex items-center gap-2 mb-3 bg-gray-800/50 rounded-lg px-3 py-2">
                  <Image
                    src={getPokemonSprite(favorite.pokemon_id)}
                    alt="Favorite Defender"
                    width={40}
                    height={40}
                    onError={(e) =>
                      handlePokemonImageError(e, favorite.pokemon_id)
                    }
                    unoptimized
                  />
                  <div className="text-sm">
                    <div className="text-gray-400 text-xs">
                      Favorite Defender
                    </div>
                    <div className="text-yellow-300 font-medium">
                      #{favorite.pokemon_id}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {renderGyms(gyms.instinct, "text-yellow-300")}
          </div>

          {/* Mystic */}
          <div className="bg-gradient-to-br from-blue-900/20 to-gray-800/50 border border-blue-800/50 flex flex-col items-center rounded-2xl p-6 shadow-xl">
            <Image
              src="/images/mystic.png"
              alt="Mystic"
              width={160}
              height={160}
              className="mb-4 drop-shadow-2xl"
              priority
            />
            <TickerCount
              value={gyms.counts.mystic}
              colorClass="text-blue-500"
            />
            <span className="text-xl font-bold text-blue-400 mb-2">
              Team Mystic
            </span>

            {/* Favorite Defender */}
            {(() => {
              const favorite = getFavoriteDefender(gyms.mystic);
              return favorite ? (
                <div className="flex items-center gap-2 mb-3 bg-gray-800/50 rounded-lg px-3 py-2">
                  <Image
                    src={getPokemonSprite(favorite.pokemon_id)}
                    alt="Favorite Defender"
                    width={40}
                    height={40}
                    onError={(e) =>
                      handlePokemonImageError(e, favorite.pokemon_id)
                    }
                    unoptimized
                  />
                  <div className="text-sm">
                    <div className="text-gray-400 text-xs">
                      Favorite Defender
                    </div>
                    <div className="text-blue-300 font-medium">
                      #{favorite.pokemon_id}
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            {renderGyms(gyms.mystic, "text-blue-300")}
          </div>
        </div>
      </div>
    </div>
  );
}
