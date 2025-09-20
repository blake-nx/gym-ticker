"use server";

import { fetchGymSnapshot, type GymApiResult } from "@/server/gymData";

export async function getGymsAction(): Promise<GymApiResult> {
  return fetchGymSnapshot();
}
