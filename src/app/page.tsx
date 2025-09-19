// app/page.tsx - Server Component
import GymDashboard from "../components/GymDashboard";
import DefenderStats from "../components/DefenderStats";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Defender = {
  pokemon_id?: number;
  [key: string]: unknown;
};

type Gym = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  url: string;
  description: string | null;
  slots: number | null;
  guarding_pokemon_id: number | null;
  updated: number;
  defenders: Defender[];
  total_cp: number | null;
};

type GymApiResult = {
  mystic: Gym[];
  valor: Gym[];
  instinct: Gym[];
  counts: { mystic: number; valor: number; instinct: number };
};

// Server-side data fetching function
async function getGyms(): Promise<GymApiResult> {
  // During build time, return empty data
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.NEXT_PUBLIC_APP_URL
  ) {
    return {
      mystic: [],
      valor: [],
      instinct: [],
      counts: { mystic: 0, valor: 0, instinct: 0 },
    };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/gyms`,
      {
        method: "GET",
        headers: {
          // These headers are automatically set by Next.js for internal requests
          "x-invoke-path": "/api/gyms",
        },
        cache: "no-store", // Ensure fresh data
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch gyms");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching gyms:", error);
    // Return empty state on error
    return {
      mystic: [],
      valor: [],
      instinct: [],
      counts: { mystic: 0, valor: 0, instinct: 0 },
    };
  }
}

// Server action for real-time updates
async function getGymsWithToken(): Promise<GymApiResult> {
  "use server";

  try {
    // First get a one-time token
    const tokenResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/gyms`,
      {
        method: "POST",
        headers: {
          "x-internal-secret": process.env.INTERNAL_API_SECRET!,
        },
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to get access token");
    }

    const { token } = await tokenResponse.json();

    // Now fetch the data with the token
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/gyms`,
      {
        method: "GET",
        headers: {
          "x-access-token": token,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch gyms");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching gyms:", error);
    return {
      mystic: [],
      valor: [],
      instinct: [],
      counts: { mystic: 0, valor: 0, instinct: 0 },
    };
  }
}

// Server action for defender stats
async function getDefenderStats() {
  "use server";

  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      }/api/defender-stats`,
      {
        method: "GET",
        headers: {
          "x-invoke-path": "/api/defender-stats",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch defender stats");
    }
    const data = await response.json();

    return data;
  } catch (error) {
    console.error("Error fetching defender stats:", error);
    return {
      teams: [],
      overall: {
        total_defenders_all_teams: 0,
        most_popular_overall: [],
        strongest_defenders: [],
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export default async function Page() {
  // Fetch initial data on the server
  const initialGyms = await getGyms();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Gym Dashboard */}
      <GymDashboard
        initialGyms={initialGyms}
        getGymsAction={getGymsWithToken}
      />

      {/* Defender Statistics */}
      <div className="px-4 pb-8">
        <DefenderStats getStatsAction={getDefenderStats} />
      </div>
    </div>
  );
}
