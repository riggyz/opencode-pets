export const actions = [
  "idle", "running-right", "running-left", "waving", "jumping",
  "failed", "waiting", "running", "review",
] as const

export type Action = typeof actions[number]
// Codex behavior rows are not all full: unused trailing atlas cells are blank.
export const frameCounts: Record<Action, number> = {
  idle: 6, "running-right": 8, "running-left": 8, waving: 4, jumping: 5,
  failed: 8, waiting: 6, running: 6, review: 6,
}
const uniform = (count: number, duration: number, last: number) => Array.from({ length: count }, (_, i) => i === count - 1 ? last : duration)
export const frameDurations: Record<Action, number[]> = {
  idle: [280, 110, 110, 140, 140, 320],
  "running-right": uniform(8, 120, 220), "running-left": uniform(8, 120, 220),
  waving: uniform(4, 140, 280), jumping: uniform(5, 140, 280), failed: uniform(8, 140, 240),
  waiting: uniform(6, 150, 260), running: uniform(6, 120, 220), review: uniform(6, 150, 280),
}
export const actionLabels: Record<Action, string> = {
  idle: "Idle", "running-right": "Walking right", "running-left": "Walking left",
  waving: "Hello!", jumping: "Happy", failed: "Something failed", waiting: "Needs input",
  running: "Working", review: "Reply ready",
}

export function animationFrame(action: Action, elapsed: number) {
  const durations = frameDurations[action]
  let time = Math.max(0, elapsed) % durations.reduce((a, b) => a + b, 0)
  for (let frame = 0; frame < durations.length; frame++) {
    if (time < durations[frame]) return frame
    time -= durations[frame]
  }
  return 0
}

export function companionAction(activity: Action, reaction?: Action, walking?: Action): Action {
  // Explicit hover feedback is brief; the session's real state remains on its marker/tooltip.
  return reaction ?? (activity !== "idle" ? activity : walking) ?? "idle"
}

// V2: 0° is up, increasing clockwise in 22.5° steps; near the face is neutral.
export function lookDirection(dx: number, dy: number, deadzone: number): number | undefined {
  if (Math.hypot(dx, dy) < deadzone) return undefined
  return (Math.round(Math.atan2(dx, -dy) * 8 / Math.PI) + 16) % 16
}
export function lookPosition(direction: number) {
  const index = ((Math.round(direction) % 16) + 16) % 16
  return `${index % 8 * 100 / 7}% ${(9 + Math.floor(index / 8)) * 10}%`
}
export interface PetManifest {
  id: string
  displayName: string
  description: string
  spriteVersionNumber: 1 | 2
  spritesheetPath: string
}
export interface Pet extends PetManifest {
  key: string
  source: string
  image: string
}
export interface Catalog { pets: Pet[]; errors: string[] }

// Codex's atlas: eight 192×208 frames per row, nine behavior rows.
// V2 adds two look-direction rows, leaving the behavior rows unchanged.
export function rowCount(version: 1 | 2) { return version === 2 ? 11 : 9 }
export function spritePosition(action: Action, frame: number, version: 1 | 2) {
  return `${(Math.floor(frame) % frameCounts[action]) * 100 / 7}% ${actions.indexOf(action) * 100 / (rowCount(version) - 1)}%`
}

export function parseManifest(value: unknown): PetManifest {
  if (!value || typeof value !== "object") throw new Error("pet.json must be an object")
  const data = value as Record<string, unknown>
  if (typeof data.id !== "string" || !data.id.trim()) throw new Error("Missing pet id")
  if (typeof data.displayName !== "string" || !data.displayName.trim()) throw new Error("Missing displayName")
  const version = data.spriteVersionNumber ?? 1
  if (version !== 1 && version !== 2) throw new Error("Unsupported spriteVersionNumber (expected 1 or 2)")
  const path = data.spritesheetPath
  if (typeof path !== "string" || !/\.(png|webp)$/i.test(path)
    || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => p === ".." || p === "")
    || /^[a-z]+:/i.test(path)) throw new Error("spritesheetPath must be a relative PNG or WebP path inside the pet folder")
  return {
    id: data.id, displayName: data.displayName,
    description: typeof data.description === "string" ? data.description : "",
    spriteVersionNumber: version, spritesheetPath: path,
  }
}

export function clampPosition(x: number, width: number, size: number) {
  return Math.max(0, Math.min(x, Math.max(0, width - size)))
}
