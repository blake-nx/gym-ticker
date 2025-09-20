"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ViewMapLink } from "./ViewMapLink";
import { resolveGymImage } from "@/utils/gymImages";

type ChartType = "line" | "area";

type ChartDataPoint = {
  time: number;
  mystic: number;
  valor: number;
  instinct: number;
  uncontrolled: number;
  total: number;
};

type ChartDisplayPoint = ChartDataPoint & {
  uncontrolled: number;
};

type ContestedGymChange = {
  from: number | null;
  to: number | null;
  timestamp: number;
};

type ContestedGym = {
  gym_id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  current_team: number;
  change_count: number;
  last_changed: number;
  recent_changes: ContestedGymChange[];
};

type GymHistoryData = {
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
};

const PERIODS: Array<"6h" | "12h" | "24h" | "48h" | "7d"> = [
  "6h",
  "12h",
  "24h",
  "48h",
  "7d",
];

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 360;
const PADDING = { top: 20, right: 20, bottom: 45, left: 70 };

const CHART_WIDTH = SVG_WIDTH - PADDING.left - PADDING.right;
const CHART_HEIGHT = SVG_HEIGHT - PADDING.top - PADDING.bottom;

function formatTimeLabel(timestamp: number, period: string) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (period === "24h" || period === "12h" || period === "6h") {
    return `${hours}:${minutes}`;
  }

  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${month}/${day} ${hours}:00`;
}

function getTeamClasses(teamId: number) {
  switch (teamId) {
    case 1:
      return {
        text: "text-blue-400",
        circle: "bg-blue-500",
        border: "border-blue-700",
        background: "bg-blue-900/30",
      };
    case 2:
      return {
        text: "text-red-400",
        circle: "bg-red-500",
        border: "border-red-700",
        background: "bg-red-900/30",
      };
    case 3:
      return {
        text: "text-yellow-400",
        circle: "bg-yellow-500",
        border: "border-yellow-700",
        background: "bg-yellow-900/30",
      };
    default:
      return {
        text: "text-gray-400",
        circle: "bg-gray-500",
        border: "border-gray-600",
        background: "bg-gray-800/60",
      };
  }
}

type TeamIconDefinition = {
  src: string;
  alt: string;
};

function getTeamIcon(teamId: number): TeamIconDefinition | null {
  switch (teamId) {
    case 1:
      return {
        src: "/images/mystic.png",
        alt: "Team Mystic icon",
      };
    case 2:
      return {
        src: "/images/valor.png",
        alt: "Team Valor icon",
      };
    case 3:
      return {
        src: "/images/instinct.png",
        alt: "Team Instinct icon",
      };
    default:
      return null;
  }
}

function teamName(teamId: number) {
  switch (teamId) {
    case 1:
      return "Mystic";
    case 2:
      return "Valor";
    case 3:
      return "Instinct";
    default:
      return "Neutral";
  }
}

function TeamIconBadge({ teamId }: { teamId?: number | null }) {
  const resolvedTeamId = teamId ?? 0;
  const icon = getTeamIcon(resolvedTeamId);
  const label = teamName(resolvedTeamId);

  if (icon) {
    return (
      <div
        className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center"
        title={label}
      >
        <Image
          src={icon.src}
          alt={icon.alt}
          width={24}
          height={24}
          className="w-5 h-5 object-contain "
        />
      </div>
    );
  }

  return (
    <div
      className="w-6 h-6 rounded-full bg-gray-600/80 flex items-center justify-center text-[10px] font-semibold text-gray-200"
      title={label}
    >
      {label.slice(0, 1)}
    </div>
  );
}

function createLinePath(
  data: ChartDataPoint[],
  getValue: (point: ChartDataPoint) => number,
  xScale: (time: number) => number,
  yScale: (value: number) => number
) {
  if (data.length === 0) return "";

  return data
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xScale(point.time)},${yScale(getValue(point))}`;
    })
    .join(" ");
}

function createAreaPath(
  data: ChartDataPoint[],
  getBase: (point: ChartDataPoint) => number,
  getTop: (point: ChartDataPoint) => number,
  xScale: (time: number) => number,
  yScale: (value: number) => number
) {
  if (data.length === 0) return "";

  const topPath = data
    .map((point, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xScale(point.time)},${yScale(getTop(point))}`;
    })
    .join(" ");

  const bottomPath = [...data]
    .reverse()
    .map((point) => `L${xScale(point.time)},${yScale(getBase(point))}`)
    .join(" ");

  return `${topPath} ${bottomPath} Z`;
}

function useChartScales(data: ChartDataPoint[], totalGyms?: number) {
  return useMemo(() => {
    if (data.length === 0) {
      return {
        xScale: () => PADDING.left,
        yScale: () => PADDING.top + CHART_HEIGHT,
        minTime: 0,
        maxTime: 1,
        maxValue: 1,
      };
    }

    const times = data.map((point) => point.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = Math.max(maxTime - minTime, 1);

    const maxTotalValue = Math.max(...data.map((point) => point.total), 0);
    const desiredMaxValue =
      totalGyms && totalGyms > 0 ? totalGyms : maxTotalValue;

    const maxValue = Math.max(desiredMaxValue, 1);

    const xScale = (time: number) =>
      PADDING.left + ((time - minTime) / timeRange) * CHART_WIDTH;

    const yScale = (value: number) =>
      PADDING.top + (1 - Math.min(value, maxValue) / maxValue) * CHART_HEIGHT;

    return { xScale, yScale, minTime, maxTime, maxValue };
  }, [data, totalGyms]);
}

export default function GymHistoryChart() {
  const [data, setData] = useState<GymHistoryData | null>(null);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("24h");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setError(null);
    if (!hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      const response = await fetch(`/api/gym-history?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to fetch history data");
      }

      const payload = (await response.json()) as GymHistoryData;
      setData(payload);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error(err);
      setError("Unable to load gym history");
      hasLoadedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    hasLoadedRef.current = false;
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const chartData = useMemo<ChartDisplayPoint[]>(() => {
    if (!data) {
      return [];
    }

    return data.chartData.map((point) => {
      const uncontrolled = Math.max(
        point.total - point.mystic - point.valor - point.instinct,
        0
      );

      return { ...point, uncontrolled };
    });
  }, [data]);

  const chartScales = useChartScales(chartData, data?.currentCounts.total);

  const yTicks = useMemo(() => {
    const ticks = 4;
    const values = [] as number[];
    for (let i = 0; i <= ticks; i += 1) {
      values.push(Math.round((chartScales.maxValue / ticks) * i));
    }
    return values;
  }, [chartScales.maxValue]);

  const xTicks = useMemo(() => {
    if (chartData.length === 0) return [] as number[];
    const ticks = Math.min(5, chartData.length);
    const { minTime, maxTime } = chartScales;
    const range = Math.max(maxTime - minTime, 1);
    return Array.from(
      { length: ticks },
      (_, index) => minTime + (range * index) / Math.max(ticks - 1, 1)
    );
  }, [chartData, chartScales]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current || chartData.length === 0) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = ((event.clientX - rect.left) / rect.width) * SVG_WIDTH;
      const clampedX = Math.min(
        Math.max(relativeX - PADDING.left, 0),
        CHART_WIDTH
      );

      const { minTime, maxTime } = chartScales;
      const timeRange = Math.max(maxTime - minTime, 1);
      const targetTime = minTime + (clampedX / CHART_WIDTH) * timeRange;

      let closestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      chartData.forEach((point, index) => {
        const distance = Math.abs(point.time - targetTime);
        if (distance < bestDistance) {
          bestDistance = distance;
          closestIndex = index;
        }
      });

      setHoverIndex(closestIndex);
    },
    [chartData, chartScales]
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-96 bg-gray-700 rounded" />
      </div>
    );
  }

  if (!data) {
    if (error) {
      return (
        <div className="bg-gray-800 rounded-xl p-6 text-center text-red-400">
          {error}
        </div>
      );
    }
    return null;
  }

  const hoveredPoint = hoverIndex !== null ? chartData[hoverIndex] : undefined;
  const hoverX =
    hoveredPoint !== undefined ? chartScales.xScale(hoveredPoint.time) : null;

  const currentUncontrolled = Math.max(
    data.currentCounts.total -
      data.currentCounts.mystic -
      data.currentCounts.valor -
      data.currentCounts.instinct,
    0
  );

  const summaryCards = [
    { label: "Mystic", value: data.currentCounts.mystic, team: 1 },
    { label: "Valor", value: data.currentCounts.valor, team: 2 },
    { label: "Instinct", value: data.currentCounts.instinct, team: 3 },
    { label: "Uncontrolled", value: currentUncontrolled, team: 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-500/60 bg-red-900/40 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-4 items-center mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-white">Gym Control History</h2>
            <ViewMapLink />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex bg-gray-700 rounded-lg p-1">
              {(["line", "area"] as ChartType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setChartType(type)}
                  className={`px-3 py-1 rounded transition-colors ${
                    chartType === type
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {type === "line" ? "Line" : "Area"}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-700 rounded-lg p-1">
              {PERIODS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`px-3 py-1 rounded transition-colors ${
                    period === value
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaryCards.map((item) => {
            const teamClasses = getTeamClasses(item.team);
            return (
              <div
                key={item.label}
                className={`${teamClasses.background} ${teamClasses.border} border rounded-lg p-3`}
              >
                <div className={`${teamClasses.text} text-sm`}>
                  {item.label}
                </div>
                <div className="text-2xl font-bold text-white">
                  {item.value}
                </div>
              </div>
            );
          })}
        </div>

        <div
          ref={containerRef}
          className="relative"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-[320px]"
            role="img"
          >
            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              fill="#111827"
              stroke="#1f2937"
              rx={8}
            />
            {yTicks.map((tick, index) => {
              const y = chartScales.yScale(tick);
              return (
                <g key={`y-${tick}-${index}`}>
                  <line
                    x1={PADDING.left}
                    y1={y}
                    x2={SVG_WIDTH - PADDING.right}
                    y2={y}
                    stroke="#374151"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={PADDING.left - 10}
                    y={y + 4}
                    className="fill-gray-400 text-xs"
                    textAnchor="end"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            {xTicks.map((tick) => {
              const x = chartScales.xScale(tick);
              return (
                <text
                  key={`x-${tick}`}
                  x={x}
                  y={SVG_HEIGHT - 10}
                  className="fill-gray-400 text-xs"
                  textAnchor="middle"
                >
                  {formatTimeLabel(tick, period)}
                </text>
              );
            })}

            {chartType === "area" ? (
              <>
                <path
                  d={createAreaPath(
                    chartData,
                    () => 0,
                    (point) => point.mystic,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="rgba(59, 130, 246, 0.45)"
                  stroke="none"
                />
                <path
                  d={createAreaPath(
                    chartData,
                    (point) => point.mystic,
                    (point) => point.mystic + point.valor,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="rgba(239, 68, 68, 0.45)"
                  stroke="none"
                />
                <path
                  d={createAreaPath(
                    chartData,
                    (point) => point.mystic + point.valor,
                    (point) => point.mystic + point.valor + point.instinct,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="rgba(245, 158, 11, 0.45)"
                  stroke="none"
                />
                <path
                  d={createAreaPath(
                    chartData,
                    (point) => point.mystic + point.valor + point.instinct,
                    (point) =>
                      point.mystic +
                      point.valor +
                      point.instinct +
                      point.uncontrolled,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="rgba(156, 163, 175, 0.45)"
                  stroke="none"
                />
              </>
            ) : (
              <>
                <path
                  d={createLinePath(
                    chartData,
                    (point) => point.mystic,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
                <path
                  d={createLinePath(
                    chartData,
                    (point) => point.valor,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth={2}
                />
                <path
                  d={createLinePath(
                    chartData,
                    (point) => point.instinct,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth={2}
                />
                <path
                  d={createLinePath(
                    chartData,
                    (point) => point.uncontrolled,
                    chartScales.xScale,
                    chartScales.yScale
                  )}
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth={2}
                />
              </>
            )}

            {hoverX !== null && (
              <line
                x1={hoverX}
                y1={PADDING.top}
                x2={hoverX}
                y2={SVG_HEIGHT - PADDING.bottom}
                stroke="#9CA3AF"
                strokeDasharray="4 4"
              />
            )}

            {hoveredPoint && (
              <>
                <circle
                  cx={chartScales.xScale(hoveredPoint.time)}
                  cy={chartScales.yScale(hoveredPoint.mystic)}
                  r={4}
                  fill="#3B82F6"
                />
                <circle
                  cx={chartScales.xScale(hoveredPoint.time)}
                  cy={chartScales.yScale(hoveredPoint.valor)}
                  r={4}
                  fill="#EF4444"
                />
                <circle
                  cx={chartScales.xScale(hoveredPoint.time)}
                  cy={chartScales.yScale(hoveredPoint.instinct)}
                  r={4}
                  fill="#F59E0B"
                />
                <circle
                  cx={chartScales.xScale(hoveredPoint.time)}
                  cy={chartScales.yScale(hoveredPoint.uncontrolled)}
                  r={4}
                  fill="#9CA3AF"
                />
              </>
            )}
          </svg>

          {hoveredPoint && (
            <div
              className="absolute bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100 shadow-lg"
              style={{
                left: `${Math.min(
                  Math.max(((hoverX ?? 0) / SVG_WIDTH) * 100, 10),
                  90
                )}%`,
                top: "10px",
              }}
            >
              <div className="font-semibold mb-1">
                {formatTimeLabel(hoveredPoint.time, period)}
              </div>
              <div className="flex flex-wrap gap-3">
                <span className="text-blue-300">
                  Mystic: {hoveredPoint.mystic}
                </span>
                <span className="text-red-300">
                  Valor: {hoveredPoint.valor}
                </span>
                <span className="text-yellow-300">
                  Instinct: {hoveredPoint.instinct}
                </span>
                <span className="text-gray-300">
                  Uncontrolled: {hoveredPoint.uncontrolled}
                </span>
              </div>
              <div className="text-gray-400 mt-1">
                Total gyms: {hoveredPoint.total}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            Most Contested Gyms ({period})
          </h2>
          <span className="text-xs text-gray-400">
            Updated: {new Date(data.lastUpdated).toLocaleString()}
          </span>
        </div>

        {data.contestedGyms.length === 0 ? (
          <div className="text-gray-400 text-center italic py-6">
            No contested gyms recorded for this period.
          </div>
        ) : (
          <div className="space-y-3">
            {data.contestedGyms.slice(0, 10).map((gym) => {
              const classes = getTeamClasses(gym.current_team);
              return (
                <div
                  key={gym.gym_id}
                  className="flex flex-col lg:flex-row lg:items-center gap-4 bg-gray-700/40 hover:bg-gray-700/60 transition-colors rounded-lg p-3"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Image
                      src={resolveGymImage(gym.url)}
                      alt={gym.name}
                      width={56}
                      height={56}
                      className="rounded-lg object-cover bg-gray-900"
                      unoptimized
                    />
                    <div>
                      <div className="font-medium text-white text-sm sm:text-base">
                        {gym.name}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
                        <span>Changes: {gym.change_count}</span>
                        <span className={classes.text}>
                          Current: {teamName(gym.current_team)}
                        </span>
                        <span>
                          Last change:{" "}
                          {new Date(gym.last_changed).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 overflow-x-auto">
                    {gym.recent_changes.slice(0, 5).map((change, index) => (
                      <div
                        key={`${gym.gym_id}-${index}`}
                        className="flex items-center gap-3 bg-gray-500/20 rounded-lg p-1 text-gray-500"
                      >
                        <TeamIconBadge teamId={change.from} />
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="white"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>{" "}
                        <TeamIconBadge teamId={change.to} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
