import { memoryManager } from "../services/memory-manager";
import { updateProcedureSchema, type UpdateProcedureInput } from "../domain/schemas/update-procedure";

export const memoryUpdateProcedureTool = {
  name: "memory_update_procedure",
  description: "Update an existing procedure.",
  inputSchema: updateProcedureSchema,
  execute: async (input: UpdateProcedureInput) => {
    const procedure = await memoryManager.updateProcedure(input.id, input);
    return { success: true, procedure };
  },
};
