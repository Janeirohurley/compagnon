import { companionModel } from "../../providers/omniroute";
import { outlineInstructions } from "./outline-instructions";

export interface OutlineConfig {
  baseUrlAvailable: boolean;
  apiKeyAvailable: boolean;
  degradeMode: boolean;
}

export function getOutlineConfig(): OutlineConfig {
  const baseUrlAvailable = !!process.env.OUTLINE_BASE_URL;
  const apiKeyAvailable = !!process.env.OUTLINE_API_KEY;
  const degradeMode = !baseUrlAvailable || !apiKeyAvailable;

  return { baseUrlAvailable, apiKeyAvailable, degradeMode };
}

export function requireOutlineConfig(): void {
  if (!process.env.OUTLINE_BASE_URL) {
    throw new Error("[Outline Agent] OUTLINE_BASE_URL is not configured.");
  }
  if (!process.env.OUTLINE_API_KEY) {
    throw new Error("[Outline Agent] OUTLINE_API_KEY is not configured.");
  }
}

export default {
  getOutlineConfig,
  requireOutlineConfig,
  instructions: outlineInstructions,
  model: companionModel,
};
