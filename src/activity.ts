import type { Action } from "./pet"

export interface ActivityState {
  outcome: "idle" | "review" | "failed"
  failureUntil: number
}
export const initialActivity: ActivityState = { outcome: "idle", failureUntil: 0 }

export function restoreActivity(info: { outcome?: string; time: { idle?: number; viewed?: number } } | undefined, running: boolean): ActivityState {
  // Session.outcome describes the last completed run, not necessarily this run.
  if (running || !info) return initialActivity
  if (info.outcome === "failed") return { outcome: "failed", failureUntil: 0 }
  if (info.outcome === "succeeded" && (info.time.idle ?? 0) > (info.time.viewed ?? 0)) return { outcome: "review", failureUntil: 0 }
  return initialActivity
}

// Consumes only event identity/metadata, never tool-output text or chat contents.
export function reduceActivity(state: ActivityState, event: { type: string; data: unknown }, sessionID: string, now: number): ActivityState {
  if (!event.data || typeof event.data !== "object" || !("sessionID" in event.data) || event.data.sessionID !== sessionID) return state
  switch (event.type) {
    case "session.execution.started":
    case "session.execution.interrupted":
    case "session.viewed":
    case "session.deleted":
    case "session.archived":
      return { ...initialActivity }
    case "session.execution.succeeded":
      return { ...state, outcome: "review" }
    case "session.execution.failed":
      return { outcome: "failed", failureUntil: 0 }
    case "session.step.failed":
    case "session.tool.failed":
      return { ...state, failureUntil: now + 4000 }
    case "session.tool.success": {
      // A shell tool can succeed as an invocation while its command exits nonzero.
      const metadata = "metadata" in event.data ? event.data.metadata : undefined
      if (!metadata || typeof metadata !== "object") return state
      const exit = "exit" in metadata ? metadata.exit : undefined
      const timeout = "timeout" in metadata ? metadata.timeout : undefined
      const signal = "signal" in metadata ? metadata.signal : undefined
      return (typeof exit === "number" && exit !== 0) || timeout === true || (typeof signal === "string" && signal.length > 0)
        ? { ...state, failureUntil: now + 4000 } : state
    }
    default: return state
  }
}

export function activityAction(state: ActivityState, waiting: boolean, running: boolean, now: number): Action {
  if (waiting) return "waiting"
  if (state.outcome === "failed" || state.failureUntil > now) return "failed"
  if (running) return "running"
  return state.outcome === "review" ? "review" : "idle"
}
