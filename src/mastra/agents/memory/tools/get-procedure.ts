import { memoryManager } from "../services/memory-manager";
import { getProcedureSchema, type GetProcedureInput } from "../domain/schemas/get-procedure";

export const memoryGetProcedureTool = {
  name: "memory_get_procedure",
  description: "Get a procedure by ID or name.",
  inputSchema: getProcedureSchema,
  execute: async (input: GetProcedureInput) => {
    const procedure = input.id 
      ? await memoryManager.getProcedure(input.id)
      : await memoryManager.getProcedureByName(input.name!);
    if (!procedure) {
      return { success: false, error: "Procedure not found" };
    }
    return { success: true, procedure };
  },
};
