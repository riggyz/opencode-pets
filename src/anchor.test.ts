import assert from "node:assert/strict"
import { test } from "node:test"
import { findPetAnchor } from "./anchor"
import { composerPlane } from "./layout"

function element(top: number, height = 120, visible = true) {
  return { top, checkVisibility: () => visible, getBoundingClientRect() { return { top: this.top, bottom: this.top + height, width: 600, height } } }
}
const dockSelector = '[data-component="session-composer-dock"]'
const inputSelector = '[data-component="dock-prompt"], [data-component="composer"]'

test("composer → question → permission → composer keeps the shared dock anchor", () => {
  const dock = element(700)
  let inputs = [element(710)]
  const query = (selector: string) => selector === dockSelector ? [dock] : inputs
  for (const [top, hasComposer] of [[700, true], [450, false], [590, false], [700, true]] as const) {
    dock.top = top
    inputs = hasComposer ? [element(top + 10)] : []
    const anchor = findPetAnchor(query, 900)
    assert.equal(anchor, dock)
    assert.equal(composerPlane(anchor?.getBoundingClientRect().top, 900), 900 - top + 4)
  }
})
test("standalone question and permission prompts anchor even without a text composer", () => {
  for (const kind of ["question", "permission"]) {
    const prompt = { ...element(500), kind }
    const anchor = findPetAnchor(selector => selector === inputSelector ? [prompt] : [], 900)
    assert.equal(anchor, prompt)
    assert.equal(composerPlane(anchor?.getBoundingClientRect().top, 900), 404)
  }
})
test("hidden cached docks and off-screen docks never override the visible prompt", () => {
  const visible = element(600)
  assert.equal(findPetAnchor(selector => selector === dockSelector ? [element(400, 120, false), element(950)] : [visible], 900), visible)
  assert.equal(findPetAnchor(() => [], 900), undefined)
})
