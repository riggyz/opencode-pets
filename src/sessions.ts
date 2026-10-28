import { activityAction, initialActivity, restoreActivity, type ActivityState } from "./activity"
import type { Action } from "./pet"
import { laneBounds, lanePosition } from "./layout"

export interface SessionBaby {
  key: string
  server: string
  id: string
  title: string
  agent: string
  activity: Action
  project: string
}
export interface SessionPet extends SessionBaby {
  subagents: SessionBaby[]
}
interface SessionInfo {
  id: string
  title?: string
  agent?: string
  parentID?: string
  projectID?: string
  location?: { directory: string }
  outcome?: string
  time: { idle?: number; viewed?: number; archived?: number }
}
export interface SessionSource {
  list(): readonly SessionInfo[]
  get(id: string): SessionInfo | undefined
  active(): readonly string[]
  status(id: string): "idle" | "running"
  root?(id: string): string
  permission: { sessions(): readonly string[]; list(id: string): readonly unknown[] | undefined }
  form: { sessions(): readonly string[]; list(id: string): readonly unknown[] | undefined }
}

export function sessionKey(server: string, id: string) { return `${server}\n${id}` }

export function sessionRoot(source: SessionSource, id: string) {
  const known = source.root?.(id)
  if (known && known !== id) return known
  const seen = new Set<string>([id])
  let root = id
  for (let parent = source.get(root)?.parentID; parent && !seen.has(parent); parent = source.get(root)?.parentID) {
    seen.add(parent)
    root = parent
  }
  return root
}

export function babyPetSize(base: number) { return Math.round(base * .55) }

export function sessionPill(title: string, project: string) {
  const chars = Array.from(title)
  return { title: `${chars.slice(0, 16).join("")}${chars.length > 16 ? "…" : ""}`, project }
}

export function sessionProject(info: SessionInfo, projectName?: (id: string) => string | undefined) {
  return (info.projectID && projectName?.(info.projectID)) || info.location?.directory.replace(/\\/g, "/").split("/").filter(Boolean).at(-1) || "No project"
}

export function followerTarget(parentX: number, parentSize: number, heading: number, index: number, width: number, count = index + 1) {
  const size = babyPetSize(parentSize)
  const lane = laneBounds(parentX, width, parentSize)
  const max = lane.max + parentSize - size
  const leftRoom = parentX - lane.min
  const rightRoom = max + size - parentX - parentSize
  const needed = size * .55 + size * .8 * Math.max(0, count - 1)
  // Keep the whole train together, flipping/compressing it near a lane edge.
  const left = heading > 0 ? leftRoom >= needed || leftRoom >= rightRoom : !(rightRoom >= needed || rightRoom >= leftRoom)
  const room = left ? leftRoom : rightRoom
  const spacing = Math.min(size * .8, Math.max(0, room - size * .55) / Math.max(1, count - 1))
  const target = left ? parentX - size * .55 - spacing * index : parentX + parentSize - size * .45 + spacing * index
  return Math.max(lane.min, Math.min(max, target))
}

export function sessionCandidates(source: SessionSource, states: Record<string, ActivityState>) {
  const ids = new Set([...source.list().map(info => info.id), ...source.active(), ...source.permission.sessions(), ...source.form.sessions(), ...Object.keys(states)])
  for (const id of ids) {
    const parent = source.get(id)?.parentID
    if (parent) ids.add(parent)
  }
  return ids
}

export function collectSessions(server: string, source: SessionSource, states: Record<string, ActivityState>, now: number, projectName?: (id: string) => string | undefined): SessionPet[] {
  // Include active/prompted children even when they are not in the cached root-session list.
  const ids = sessionCandidates(source, states)
  const families = new Map<string, Set<string>>()
  for (const id of ids) {
    // Unknown metadata may be an undiscovered subagent. Wait for hydration rather
    // than briefly spawning it as a separate root-chat pet.
    if (!source.get(id)) continue
    const root = sessionRoot(source, id)
    if (!families.has(root)) families.set(root, new Set([root]))
    families.get(root)!.add(id)
  }
  return [...families].flatMap(([id, family]) => {
    const info = source.get(id)
    if (!info || info.time.archived) return []
    const subagents = [...family].flatMap(child => {
      const childInfo = source.get(child)
      if (child === id || !childInfo || childInfo.time.archived) return []
      const running = source.status(child) === "running"
      const waiting = !!(source.permission.list(child)?.length || source.form.list(child)?.length)
      if (!running && !waiting) return []
      return [{ key: sessionKey(server, child), server, id: child, title: childInfo.title || `Session ${child.slice(-6)}`, agent: childInfo.agent || "Agent", project: sessionProject(childInfo.location ? childInfo : info, projectName), activity: activityAction(states[child] ?? initialActivity, waiting, running, now) }]
    })
    const running = source.status(id) === "running" || subagents.some(child => source.status(child.id) === "running")
    const unread = (info?.time.idle ?? 0) > (info?.time.viewed ?? 0)
    // Do not fill the window with old, already-read historical failures/completions.
    const state = states[id] ?? (unread ? restoreActivity(info, running) : initialActivity)
    const waiting = [...family].some(child => !source.get(child)?.time.archived && (source.permission.list(child)?.length || source.form.list(child)?.length))
    return [{ key: sessionKey(server, id), server, id, title: info.title || `Session ${id.slice(-6)}`, agent: info.agent || "Agent", project: sessionProject(info, projectName), subagents, activity: activityAction(state, waiting, running, now) }]
  })
}

export interface GuestPet {
  session: SessionPet
  leaving: boolean
}

export function reconcileColony(previous: GuestPet[], sessions: SessionPet[], residentKey?: string): GuestPet[] {
  const active = new Map(sessions.filter(session => session.key === residentKey || session.activity !== "idle").map(session => [session.key, session]))
  const guests = previous.flatMap(guest => {
    const session = active.get(guest.session.key)
    active.delete(guest.session.key)
    return [{ session: session ?? guest.session, leaving: !session }]
  })
  return [...guests, ...[...active.values()].map(session => ({ session, leaving: false }))]
}

export function guestPosition(index: number, count: number, width: number, size: number) {
  const sideCount = Math.ceil(count / 2)
  const room = Math.max(0, width / 3 - size)
  return lanePosition((index % 2 ? width * 2 / 3 : 0) + room * (Math.floor(index / 2) + 1) / (sideCount + 1), width, size)
}

export function departureStep(x: number, width: number, size: number, delta: number) {
  const direction = x + size / 2 < width / 2 ? -1 : 1
  const next = x + direction * Math.min(200, Math.max(0, delta)) * .18
  return { x: next, action: direction < 0 ? "running-left" as const : "running-right" as const, done: next + size < 0 || next > width }
}
