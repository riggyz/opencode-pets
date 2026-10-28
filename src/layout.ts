import type { Pet } from "./pet"

// Window-wide side lanes: sprite bounds never enter the middle third.
export function laneBounds(x: number, width: number, size: number) {
  const left = x + size / 2 < width / 2
  return { min: left ? 0 : width * 2 / 3, max: Math.max(left ? 0 : width * 2 / 3, (left ? width / 3 : width) - size) }
}

export function lanePosition(x: number, width: number, size: number) {
  const bounds = laneBounds(x, width, size)
  return Math.max(bounds.min, Math.min(bounds.max, x))
}

export function babyHop(now: number, index: number) {
  return Math.max(0, Math.sin(now / 1400 * Math.PI * 2 - index * .7)) * 9
}

export function sessionPet(title: string, pets: readonly Pet[]) {
  // Rendezvous hashing is independent of catalog order and only reassigns a
  // session when a new pet wins its score (or its previous pet is removed).
  let chosen: Pet | undefined
  let best = -1
  for (const pet of pets) {
    let hash = 2166136261
    for (const char of `${title}\n${pet.key}`) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0
    if (hash > best || (hash === best && pet.key < (chosen?.key ?? ""))) { best = hash; chosen = pet }
  }
  return chosen
}

export function composerPlane(top: number | undefined, height: number) {
  return top === undefined ? 12 : Math.max(12, Math.min(height - 48, height - top + 4))
}
