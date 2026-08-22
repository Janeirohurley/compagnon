export { planeAdvancementTool } from "./plane-advancement-tool";
export { planeBlockageTool } from "./plane-blockage-tool";

import { planeAdvancementTool } from "./plane-advancement-tool";
import { planeBlockageTool } from "./plane-blockage-tool";

// Default export for Mastra fs-agent build process
export default {
  plane_get_advancement: planeAdvancementTool,
  plane_detect_blockages: planeBlockageTool,
};
