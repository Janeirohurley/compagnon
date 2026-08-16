// Memory observability events

export type MemoryEventType =
  | "memory.retrieved"
  | "memory.created"
  | "memory.updated"
  | "memory.deleted"
  | "memory.archived"
  | "memory.conflict.detected"
  | "memory.verification.completed"
  | "memory.consolidated"
  | "memory.extraction.rejected";

export interface MemoryEvent {
  type: MemoryEventType;
  timestamp: Date;
  memoryId?: string;
  memoryType?: string;
  scope?: string;
  scopeId?: string;
  details?: Record<string, unknown>;
}

// Simple event logger
const events: MemoryEvent[] = [];

export function logMemoryEvent(event: Omit<MemoryEvent, "timestamp">): void {
  const fullEvent: MemoryEvent = {
    ...event,
    timestamp: new Date(),
  };
  events.push(fullEvent);
  
  // Console log for now (can be extended to use actual logging infrastructure)
  console.log(`[Memory:${event.type}]`, {
    memoryId: event.memoryId,
    memoryType: event.memoryType,
    scope: event.scope,
  });
}

export function getMemoryEvents(limit = 100): MemoryEvent[] {
  return events.slice(-limit);
}

export function clearMemoryEvents(): void {
  events.length = 0;
}
