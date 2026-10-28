import assert from "node:assert/strict"
import { test } from "node:test"
import { actions, animationFrame, clampPosition, companionAction, frameCounts, frameDurations, lookDirection, lookPosition, parseManifest, rowCount, spritePosition } from "./pet"

const manifest = { id: "cat", displayName: "Cat", spritesheetPath: "spritesheet.png" }
test("Codex manifests default to v1 and preserve v2", () => {
  assert.equal(parseManifest(manifest).spriteVersionNumber, 1)
  assert.equal(parseManifest({ ...manifest, spriteVersionNumber: 2 }).spriteVersionNumber, 2)
  assert.equal(rowCount(1), 9)
  assert.equal(rowCount(2), 11)
})
test("rejects malformed metadata, unsupported atlases and unsafe asset paths", () => {
  for (const value of [null, {}, { ...manifest, id: "" }, { ...manifest, displayName: 4 }, { ...manifest, spriteVersionNumber: 3 }]) assert.throws(() => parseManifest(value))
  for (const path of ["../secret.png", "/secret.png", "https://site.test/cat.png", "C:\\cat.png", "x/../../cat.png", "cat.svg", "x//cat.png"]) assert.throws(() => parseManifest({ ...manifest, spritesheetPath: path }))
  assert.equal(parseManifest({ ...manifest, spritesheetPath: "assets/cat.webp" }).spritesheetPath, "assets/cat.webp")
})
test("all nine Codex action rows align for v1 and v2", () => {
  for (const version of [1, 2] as const) {
    actions.forEach((action, row) => {
      assert.equal(spritePosition(action, 0, version), `0% ${row * 100 / (rowCount(version) - 1)}%`)
      const count = frameCounts[action]
      assert.equal(spritePosition(action, count - 1, version), `${(count - 1) * 100 / 7}% ${row * 100 / (rowCount(version) - 1)}%`)
      assert.equal(spritePosition(action, count, version), spritePosition(action, 0, version))
    })
  }
})
test("short Codex animation rows never enter empty trailing cells", () => {
  assert.deepEqual(actions.map(action => frameCounts[action]), [6, 8, 8, 4, 5, 8, 6, 6, 6])
  for (const action of actions) {
    for (let tick = 0; tick < 240; tick++) {
      const column = parseFloat(spritePosition(action, tick % 120, 2)) * 7 / 100
      assert.ok(column < frameCounts[action])
      assert.equal(spritePosition(action, tick % 120, 2), spritePosition(action, tick, 2))
    }
  }
})
test("dragging and window resizing keep the pet in bounds", () => {
  assert.equal(clampPosition(-10, 800, 96), 0)
  assert.equal(clampPosition(1000, 800, 96), 704)
  assert.equal(clampPosition(200, 50, 96), 0)
})
test("each Codex behavior uses its exact frame timing and loops without blank cells", () => {
  for (const action of actions) {
    const durations = frameDurations[action]
    assert.equal(durations.length, frameCounts[action])
    let elapsed = 0
    durations.forEach((duration, frame) => {
      assert.equal(animationFrame(action, elapsed), frame)
      assert.equal(animationFrame(action, elapsed + duration - 1), frame)
      elapsed += duration
    })
    assert.equal(animationFrame(action, elapsed), 0)
  }
})
test("all sixteen v2 look directions run clockwise from up across rows 9 and 10", () => {
  for (let index = 0; index < 16; index++) {
    const radians = index * Math.PI / 8
    assert.equal(lookDirection(Math.sin(radians) * 100, -Math.cos(radians) * 100, 24), index)
    assert.equal(lookPosition(index), `${index % 8 * 100 / 7}% ${index < 8 ? 90 : 100}%`)
  }
  assert.equal(lookDirection(0, 0, 24), undefined)
  assert.equal(lookDirection(10, 10, 24), undefined)
})
test("hover feedback briefly overrides poses; session activity overrides wandering", () => {
  for (const activity of ["waiting", "failed", "running", "review"] as const) {
    assert.equal(companionAction(activity, "jumping", "running-left"), "jumping")
    assert.equal(companionAction(activity, undefined, "running-left"), activity)
  }
  assert.equal(companionAction("running", undefined, "running-left"), "running")
  assert.equal(companionAction("review", undefined, "running-left"), "review")
  assert.equal(companionAction("idle", "waving", "running-left"), "waving")
  assert.equal(companionAction("idle", undefined, "running-left"), "running-left")
  assert.equal(companionAction("idle"), "idle")
})
