import { batch } from "solid-js"

interface Subscriber {
  tick(now: number, delta: number): void
  pointer(event: PointerEvent): void
  leave(): void
}

// One clock and pointer listener per window, regardless of the number of babies.
// Pointer events are sampled at animation cadence rather than hardware cadence.
const subscribers = new Set<Subscriber>()
let stop: (() => void) | undefined

export function subscribeAnimation(subscriber: Subscriber) {
  subscribers.add(subscriber)
  if (!stop) {
    let pointer: PointerEvent | undefined
    let previous = performance.now()
    const move = (event: PointerEvent) => { if (event.pointerType !== "touch") pointer = event }
    const leave = () => { pointer = undefined; batch(() => subscribers.forEach(item => item.leave())) }
    const visibility = () => { previous = performance.now(); leave() }
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(200, now - previous)
      previous = now
      if (document.hidden) { pointer = undefined; return }
      const event = pointer
      pointer = undefined
      batch(() => {
        for (const item of subscribers) {
          if (event) item.pointer(event)
          item.tick(now, delta)
        }
      })
    }, 50)
    window.addEventListener("pointermove", move, { passive: true })
    document.addEventListener("pointerleave", leave)
    document.addEventListener("visibilitychange", visibility)
    stop = () => {
      clearInterval(timer)
      window.removeEventListener("pointermove", move)
      document.removeEventListener("pointerleave", leave)
      document.removeEventListener("visibilitychange", visibility)
    }
  }
  return () => {
    subscribers.delete(subscriber)
    if (!subscribers.size) { stop?.(); stop = undefined }
  }
}
