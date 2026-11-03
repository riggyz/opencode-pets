import assert from "node:assert/strict"
import { test } from "node:test"
import { subscribeAnimation } from "./clock"

test("pets share a sampled clock and release listeners when the last pet unmounts", t => {
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), { hidden: false })
  for (const [key, value] of Object.entries({ window, document })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key)
    Object.defineProperty(globalThis, key, { configurable: true, value })
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key) })
  }
  let tick = () => {}
  let timers = 0
  let cleared = 0
  t.mock.method(globalThis, "setInterval", (callback: () => void) => { tick = callback; timers++; return 1 })
  t.mock.method(globalThis, "clearInterval", () => { cleared++ })
  const removeWindow = t.mock.method(window, "removeEventListener")
  const removeDocument = t.mock.method(document, "removeEventListener")
  const ticks = [0, 0]
  const points: number[] = []
  const subscribe = (index: number) => subscribeAnimation({
    tick: () => { ticks[index]++ },
    pointer: event => { points.push(event.clientX) },
    leave: () => {},
  })
  const first = subscribe(0)
  const second = subscribe(1)
  try {
    assert.equal(timers, 1)
    for (let x = 0; x < 100; x++) window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: x, pointerType: "mouse" }))
    assert.deepEqual(points, [])
    tick()
    assert.deepEqual(points, [99, 99])
    assert.deepEqual(ticks, [1, 1])
    tick()
    assert.deepEqual(points, [99, 99], "a sampled event is delivered only once")
    document.hidden = true
    tick()
    assert.deepEqual(ticks, [2, 2], "hidden documents do no animation work")
    document.hidden = false
    first()
    tick()
    assert.deepEqual(ticks, [2, 3])
    assert.equal(cleared, 0)
  } finally { first(); second() }
  assert.equal(cleared, 1)
  assert.equal(removeWindow.mock.callCount(), 1)
  assert.equal(removeDocument.mock.callCount(), 2)
  const again = subscribe(0)
  assert.equal(timers, 2, "remount starts one fresh clock")
  again()
  assert.equal(cleared, 2)
})
