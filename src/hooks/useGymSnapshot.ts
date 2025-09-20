"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { GymApiResult } from "@/server/gymData";

interface UseGymSnapshotResult {
  gyms: GymApiResult;
  isPending: boolean;
  updateError: boolean;
  isClient: boolean;
}

export function useGymSnapshot(
  initialGyms: GymApiResult,
  getGymsAction: () => Promise<GymApiResult>
): UseGymSnapshotResult {
  const [gyms, setGyms] = useState<GymApiResult>(initialGyms);
  const [isPending, startTransition] = useTransition();
  const [updateError, setUpdateError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const actionRef = useRef(getGymsAction);

  useEffect(() => {
    actionRef.current = getGymsAction;
  }, [getGymsAction]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      return;
    }

    let isMounted = true;

    const refreshGyms = async () => {
      try {
        const newGyms = await actionRef.current();
        if (!isMounted) {
          return;
        }
        setGyms(newGyms);
        setUpdateError(false);
      } catch (error) {
        console.error("Failed to update gyms:", error);
        if (isMounted) {
          setUpdateError(true);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        void refreshGyms();
      });
    }, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isClient, startTransition]);

  return { gyms, isPending, updateError, isClient };
}
