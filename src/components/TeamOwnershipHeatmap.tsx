"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ViewMapLink } from "./ViewMapLink";
import type { GymApiResult, Gym } from "@/server/gymData";

interface TeamOwnershipHeatmapProps {
  gyms: GymApiResult;
  isClient: boolean;
  isUpdating: boolean;
}

type TeamKey = "valor" | "instinct" | "mystic";
type HeatPoint = [number, number, number];

type HeatLayer = {
  setLatLngs: (latlngs: HeatPoint[]) => void;
  setOptions: (options: HeatLayerOptions) => void;
  remove: () => void;
  addTo: (map: LeafletMap) => HeatLayer;
};

type HeatLayerOptions = {
  radius: number;
  blur: number;
  maxZoom: number;
  gradient: Record<number, string>;
  minOpacity?: number;
};

type LeafletMap = {
  remove: () => void;
  fitBounds: (
    bounds: unknown,
    options?: { padding?: [number, number]; maxZoom?: number }
  ) => void;
  addLayer: (layer: unknown) => void;
  removeLayer: (layer: unknown) => void;
  on: (event: string, handler: () => void) => LeafletMap;
  off: (event: string, handler: () => void) => LeafletMap;
};

type LeafletInstance = {
  map: (
    container: HTMLDivElement,
    options: {
      zoomControl: boolean;
      attributionControl: boolean;
      preferCanvas: boolean;
    }
  ) => LeafletMap;
  tileLayer: (
    url: string,
    options: { attribution: string; maxZoom?: number }
  ) => { addTo: (map: LeafletMap) => void };
  latLngBounds: (latlngs: Array<[number, number]>) => unknown;
  heatLayer: (points: HeatPoint[], options: HeatLayerOptions) => HeatLayer;
};

const TEAM_GRADIENTS: Record<TeamKey, Record<number, string>> = {
  valor: {
    0: "rgba(254, 226, 226, 0)",
    0.3: "rgba(252, 165, 165, 0.45)",
    0.5: "rgba(248, 113, 113, 0.65)",
    0.7: "rgba(239, 68, 68, 0.85)",
    1: "rgba(185, 28, 28, 1)",
  },
  instinct: {
    0: "rgba(254, 249, 195, 0)",
    0.3: "rgba(253, 224, 71, 0.45)",
    0.5: "rgba(250, 204, 21, 0.65)",
    0.7: "rgba(234, 179, 8, 0.85)",
    1: "rgba(202, 138, 4, 1)",
  },
  mystic: {
    0: "rgba(191, 219, 254, 0)",
    0.3: "rgba(147, 197, 253, 0.45)",
    0.5: "rgba(96, 165, 250, 0.65)",
    0.7: "rgba(59, 130, 246, 0.85)",
    1: "rgba(37, 99, 235, 1)",
  },
};

const TEAM_LABELS: Record<TeamKey, string> = {
  valor: "Team Valor",
  instinct: "Team Instinct",
  mystic: "Team Mystic",
};

const TEAM_COLORS: Record<TeamKey, string> = {
  valor: "red",
  instinct: "yellow",
  mystic: "blue",
};

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_HEAT_JS =
  "https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js";

let leafletPromise: Promise<LeafletInstance> | null = null;

function ensureLeaflet(): Promise<LeafletInstance> {
  if (leafletPromise) {
    return leafletPromise;
  }

  leafletPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve({} as LeafletInstance);
      return;
    }

    const loadStylesheet = (href: string) => {
      if (document.querySelector(`link[href='${href}']`)) {
        return;
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    const loadScript = (src: string) =>
      new Promise<void>((res, rej) => {
        const existing = document.querySelector(
          `script[src='${src}']`
        ) as HTMLScriptElement | null;
        if (existing) {
          if (existing.dataset.loaded === "true") {
            res();
            return;
          }
          existing.addEventListener("load", () => res());
          existing.addEventListener("error", () =>
            rej(new Error(`Failed to load ${src}`))
          );
          return;
        }

        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.loading = "true";
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          res();
        });
        script.addEventListener("error", () =>
          rej(new Error(`Failed to load ${src}`))
        );
        document.body.appendChild(script);
      });

    try {
      loadStylesheet(LEAFLET_CSS);
    } catch (error) {
      console.error("Failed to attach Leaflet stylesheet", error);
    }

    loadScript(LEAFLET_JS)
      .then(() => loadScript(LEAFLET_HEAT_JS))
      .then(() => {
        const leaflet = (window as unknown as { L?: LeafletInstance }).L;
        if (!leaflet) {
          leafletPromise = null;
          reject(new Error("Leaflet failed to load"));
          return;
        }
        resolve(leaflet);
      })
      .catch((error) => {
        leafletPromise = null;
        reject(error);
      });
  });

  return leafletPromise;
}

function computeIntensity(gym: Gym): number {
  const defenders = Math.min(gym.defenders?.length ?? 0, 6);
  const defenderWeight = defenders / 6;
  const now = Math.floor(Date.now() / 1000);
  const secondsSinceUpdate = Math.max(0, now - gym.updated);
  const decayWindow = 6 * 60 * 60;
  const recencyWeight =
    1 - Math.min(secondsSinceUpdate, decayWindow) / decayWindow;
  const base = 0.3 + defenderWeight * 0.45 + recencyWeight * 0.25;
  return Math.max(0.2, Math.min(1, base));
}

function sanitizeGyms(gyms: Gym[]): Gym[] {
  return gyms.filter(
    (gym) =>
      Number.isFinite(gym.lat) &&
      Number.isFinite(gym.lon) &&
      Math.abs(gym.lat) <= 90 &&
      Math.abs(gym.lon) <= 180
  );
}

function toHeatPoints(gyms: Gym[]): HeatPoint[] {
  return sanitizeGyms(gyms).map(
    (gym) => [gym.lat, gym.lon, computeIntensity(gym)] as HeatPoint
  );
}

type BoundsSummary = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

function summarizeBounds(points: Array<[number, number]>): BoundsSummary {
  return points.reduce<BoundsSummary>(
    (acc, [lat, lon]) => ({
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLon: Math.min(acc.minLon, lon),
      maxLon: Math.max(acc.maxLon, lon),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLon: Number.POSITIVE_INFINITY,
      maxLon: Number.NEGATIVE_INFINITY,
    }
  );
}

function boundsAreSimilar(
  a: BoundsSummary,
  b: BoundsSummary,
  epsilon = 1e-5
): boolean {
  return (
    Math.abs(a.minLat - b.minLat) <= epsilon &&
    Math.abs(a.maxLat - b.maxLat) <= epsilon &&
    Math.abs(a.minLon - b.minLon) <= epsilon &&
    Math.abs(a.maxLon - b.maxLon) <= epsilon
  );
}

export default function TeamOwnershipHeatmap({
  gyms,
  isClient,
  isUpdating,
}: TeamOwnershipHeatmapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRefs = useRef<Record<TeamKey, HeatLayer | null>>({
    valor: null,
    instinct: null,
    mystic: null,
  });
  const hasInteractedRef = useRef(false);
  const interactionHandlerRef = useRef<(() => void) | null>(null);
  const boundsSummaryRef = useRef<BoundsSummary | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  const allGyms = useMemo(
    () => [...gyms.valor, ...gyms.instinct, ...gyms.mystic],
    [gyms.valor, gyms.instinct, gyms.mystic]
  );

  const teamPoints = useMemo(
    () => ({
      valor: toHeatPoints(gyms.valor),
      instinct: toHeatPoints(gyms.instinct),
      mystic: toHeatPoints(gyms.mystic),
    }),
    [gyms.valor, gyms.instinct, gyms.mystic]
  );

  useEffect(() => {
    if (!isClient) {
      return;
    }

    let active = true;
    ensureLeaflet()
      .then(() => {
        if (active) {
          setLeafletReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to load Leaflet resources", error);
      });

    return () => {
      active = false;
    };
  }, [isClient]);

  useEffect(() => {
    if (!leafletReady || !isClient || mapRef.current || !containerRef.current) {
      return;
    }

    ensureLeaflet()
      .then((leaflet) => {
        const map = leaflet.map(containerRef.current!, {
          zoomControl: true,
          attributionControl: true,
          preferCanvas: true,
        });
        leaflet
          .tileLayer(
            "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            {
              attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
              maxZoom: 19,
            }
          )
          .addTo(map);
        hasInteractedRef.current = false;
        const handleInteraction = () => {
          hasInteractedRef.current = true;
        };
        interactionHandlerRef.current = handleInteraction;
        map.on("mousedown", handleInteraction);
        map.on("touchstart", handleInteraction);
        map.on("wheel", handleInteraction);
        mapRef.current = map;
      })
      .catch((error) => {
        console.error("Failed to initialize Leaflet map", error);
      });
  }, [leafletReady, isClient]);

  useEffect(() => {
    const map = mapRef.current;
    if (!leafletReady || !map) {
      return;
    }

    ensureLeaflet()
      .then((leaflet) => {
        const validGyms = sanitizeGyms(allGyms);
        if (validGyms.length === 0) {
          boundsSummaryRef.current = null;
          return;
        }
        const points = validGyms.map(
          (gym) => [gym.lat, gym.lon] as [number, number]
        );
        const summary = summarizeBounds(points);
        const lastSummary = boundsSummaryRef.current;
        const changed = !lastSummary || !boundsAreSimilar(summary, lastSummary);
        boundsSummaryRef.current = summary;

        if (lastSummary && hasInteractedRef.current && changed) {
          return;
        }

        if (!changed) {
          return;
        }

        const bounds = leaflet.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      })
      .catch((error) => {
        console.error("Failed to update map bounds", error);
      });
  }, [allGyms, leafletReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!leafletReady || !map) {
      return;
    }

    ensureLeaflet()
      .then((leaflet) => {
        (Object.keys(teamPoints) as TeamKey[]).forEach((team) => {
          const points = teamPoints[team];
          const existingLayer = layerRefs.current[team];

          if (!points.length) {
            if (existingLayer) {
              map.removeLayer(existingLayer);
              layerRefs.current[team] = null;
            }
            return;
          }

          const options: HeatLayerOptions = {
            radius: 8,
            blur: 5,
            maxZoom: 18,
            minOpacity: 0.85,
            gradient: TEAM_GRADIENTS[team],
          };

          if (!existingLayer) {
            const layer = leaflet.heatLayer(points, options).addTo(map);
            layerRefs.current[team] = layer;
          } else {
            existingLayer.setOptions(options);
            existingLayer.setLatLngs(points);
          }
        });
      })
      .catch((error) => {
        console.error("Failed to update heat layers", error);
      });
  }, [leafletReady, teamPoints]);

  useEffect(() => {
    const storedLayers = layerRefs.current;
    const storedMap = mapRef.current;

    return () => {
      Object.values(storedLayers).forEach((layer) => {
        layer?.remove();
      });
      if (storedMap) {
        const handler = interactionHandlerRef.current;
        if (handler) {
          storedMap.off("mousedown", handler);
          storedMap.off("touchstart", handler);
          storedMap.off("wheel", handler);
        }
        storedMap.remove();
      }
      layerRefs.current = { valor: null, instinct: null, mystic: null };
      mapRef.current = null;
      interactionHandlerRef.current = null;
      hasInteractedRef.current = false;
      boundsSummaryRef.current = null;
    };
  }, []);

  const hasGyms = allGyms.some(
    (gym) =>
      Number.isFinite(gym.lat) &&
      Number.isFinite(gym.lon) &&
      Math.abs(gym.lat) <= 90 &&
      Math.abs(gym.lon) <= 180
  );

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl shadow-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-700 bg-gray-900/70">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Team Ownership Heatmap
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <ViewMapLink />
          {isUpdating && (
            <div className="text-xs px-3 py-1 bg-blue-600/80 text-white rounded-full animate-pulse">
              Updating...
            </div>
          )}
        </div>
      </div>

      <div className="relative h-[480px]">
        {!isClient || !leafletReady ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Preparing map...
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" />
        )}

        {leafletReady && (
          <div className="absolute bottom-4 right-4 bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 space-y-2 shadow-lg">
            <div className="font-semibold text-white">Team legend</div>
            {(Object.keys(TEAM_LABELS) as TeamKey[]).map((team) => (
              <div key={team} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: TEAM_COLORS[team] }}
                />
                <span>{TEAM_LABELS[team]}</span>
              </div>
            ))}
          </div>
        )}

        {leafletReady && !hasGyms && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-gray-900/80 text-gray-300 px-4 py-2 rounded-lg">
              No gyms available to display.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
