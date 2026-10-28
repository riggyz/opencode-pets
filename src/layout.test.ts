import assert from "node:assert/strict"
import { test } from "node:test"
import { babyHop, composerPlane, laneBounds, lanePosition, sessionPet } from "./layout"
import type { Pet } from "./pet"

test("dragging, roaming and spawning keep full sprites outside the middle third", () => {
  for (const width of [600, 1000, 1440]) for (const size of [35, 64, 96, 160]) {
    for (const x of [-100, 0, width / 3, width / 2, width * 2 / 3, width + 100]) {
      const next = lanePosition(x, width, size)
      assert.ok(next >= 0 && next + size <= width)
      assert.ok(next + size <= width / 3 || next >= width * 2 / 3)
      const bounds = laneBounds(next, width, size)
      assert.ok(bounds.min <= next && next <= bounds.max)
    }
  }
})
test("baby sine hops are phased in order, periodic, and never dip under the plane", () => {
  assert.ok(babyHop(200, 0) > babyHop(200, 1))
  assert.ok(babyHop(200, 1) > babyHop(200, 2))
  for (let now = 0; now < 5000; now += 50) for (let index = 0; index < 8; index++) {
    assert.ok(babyHop(now, index) >= 0 && babyHop(now, index) <= 9)
    assert.ok(Math.abs(babyHop(now, index) - babyHop(now + 1400, index)) < .00001)
  }
})
test("name-based pet assignment is deterministic and independent of catalog ordering", () => {
  const pets = ["byte", "blendy", "unicorn"].map(key => ({ key }) as Pet)
  assert.equal(sessionPet("Working on pets", pets), sessionPet("Working on pets", [...pets].reverse()))
  assert.ok(new Set(Array.from({ length: 50 }, (_, index) => sessionPet(`Chat ${index}`, pets)?.key)).size > 1)
  assert.equal(sessionPet("Anything", []), undefined)
  assert.equal(sessionPet("Anything", [pets[0]]), pets[0])
})
test("pet plane follows composer top and falls back safely when absent", () => {
  assert.equal(composerPlane(700, 900), 204)
  assert.equal(composerPlane(500, 900), 404)
  assert.equal(composerPlane(undefined, 900), 12)
  assert.equal(composerPlane(-50, 900), 852)
})
