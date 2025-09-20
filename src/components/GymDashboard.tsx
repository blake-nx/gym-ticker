"use client";

import GymTicker from "./GymTicker";
import TeamOwnershipHeatmap from "./TeamOwnershipHeatmap";
import { useGymSnapshot } from "@/hooks/useGymSnapshot";
import type { GymApiResult } from "@/server/gymData";

interface GymDashboardProps {
  initialGyms: GymApiResult;
  getGymsAction: () => Promise<GymApiResult>;
}

export default function GymDashboard({
  initialGyms,
  getGymsAction,
}: GymDashboardProps) {
  const { gyms, isPending, updateError, isClient } = useGymSnapshot(
    initialGyms,
    getGymsAction
  );

  return (
    <>
      <GymTicker
        gyms={gyms}
        isPending={isPending}
        updateError={updateError}
        isClient={isClient}
      />

      <div className="max-w-7xl mx-auto w-full px-4 mt-8 mb-12">
        <TeamOwnershipHeatmap
          gyms={gyms}
          isClient={isClient}
          isUpdating={isPending}
        />
      </div>
    </>
  );
}
