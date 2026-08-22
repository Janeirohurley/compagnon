import { companionModel } from "../../providers/omniroute";
import { planeInstructions } from "./plane-instructions";

export interface PlaneConfig {
  apiKeyAvailable: boolean;
  workspaceAvailable: boolean;
  degradeMode: boolean;
}

export function getPlaneConfig(): PlaneConfig {
  const apiKeyAvailable = !!process.env.PLANE_API_KEY;
  const workspaceAvailable = !!process.env.PLANE_WORKSPACE_SLUG;
  const degradeMode = !apiKeyAvailable || !workspaceAvailable;

  return { apiKeyAvailable, workspaceAvailable, degradeMode };
}

export function requirePlaneConfig(): void {
  if (!process.env.PLANE_API_KEY) {
    throw new Error(
      "[Plane Agent] PLANE_API_KEY is not configured."
    );
  }
  if (!process.env.PLANE_WORKSPACE_SLUG) {
    throw new Error(
      "[Plane Agent] PLANE_WORKSPACE_SLUG is not configured."
    );
  }
}

export default {
  getPlaneConfig,
  requirePlaneConfig,
  instructions: planeInstructions,
  model: companionModel,
};
