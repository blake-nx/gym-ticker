import GymDashboard from "../components/GymDashboard";
import GymHistoryChart from "../components/GymHistoryChart";
import DefenderStats from "../components/DefenderStats";
import { getGymsAction } from "./actions/getGyms";
import { getDefenderStatsAction } from "./actions/getDefenderStats";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const initialGyms = await getGymsAction();

  const refreshGyms = getGymsAction.bind(null);
  const loadDefenderStats = getDefenderStatsAction.bind(null);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-white">Pokémon GO Gym Tracker</h1>
        <p className="text-gray-400 mt-2">
          Live gym control statistics, historical trends, and contested gym activity
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 mb-8">
        <GymHistoryChart />
      </div>

      <GymDashboard initialGyms={initialGyms} getGymsAction={refreshGyms} />

      <div className="px-4 pb-8">
        <DefenderStats getStatsAction={loadDefenderStats} />
      </div>
    </div>
  );
}
