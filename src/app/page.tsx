import GymDashboard from "../components/GymDashboard";
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
      {/* Gym Dashboard */}
      <GymDashboard initialGyms={initialGyms} getGymsAction={refreshGyms} />

      {/* Defender Statistics */}
      <div className="px-4 pb-8">
        <DefenderStats getStatsAction={loadDefenderStats} />
      </div>
    </div>
  );
}
