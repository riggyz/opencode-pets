import assert from "node:assert/strict"
import { test } from "node:test"
import { sessionPet } from "./layout"
import { chatPet, selectChatPet, type ChatPetSelections } from "./selection"
import type { Pet } from "./pet"

const pets = ["byte", "nurgling", "iron"].map(key => ({ key }) as Pet)

test("chats without an override retain the automatic name-based assignment", () => {
  assert.equal(chatPet("server\nchat", "My chat", pets, {}), sessionPet("My chat", pets))
})
test("manual selection is stable across renames and catalog reordering", () => {
  const selections: ChatPetSelections = {}
  selectChatPet(selections, "server\nchat", "iron")
  assert.equal(chatPet("server\nchat", "Original title", pets, selections), pets[2])
  assert.equal(chatPet("server\nchat", "Renamed title", [...pets].reverse(), selections), pets[2])
})
test("selections are independent for chats with the same title and across servers", () => {
  const selections: ChatPetSelections = {}
  selectChatPet(selections, "server-a\nchat-a", "nurgling")
  selectChatPet(selections, "server-a\nchat-b", "iron")
  selectChatPet(selections, "server-b\nchat-a", "byte")
  assert.equal(chatPet("server-a\nchat-a", "Same title", pets, selections), pets[1])
  assert.equal(chatPet("server-a\nchat-b", "Same title", pets, selections), pets[2])
  assert.equal(chatPet("server-b\nchat-a", "Same title", pets, selections), pets[0])
})
test("choosing automatic clears only that chat's saved selection", () => {
  const selections: ChatPetSelections = { "server\na": "iron", "server\nb": "nurgling" }
  selectChatPet(selections, "server\na", undefined)
  assert.deepEqual(selections, { "server\nb": "nurgling" })
  assert.equal(chatPet("server\na", "Automatic", pets, selections), sessionPet("Automatic", pets))
})
test("removed pets fall back safely and recover their selection if reinstalled", () => {
  const selections = { "server\nchat": "iron" }
  const remaining = pets.slice(0, 2)
  assert.equal(chatPet("server\nchat", "Chat", remaining, selections), sessionPet("Chat", remaining))
  assert.equal(chatPet("server\nchat", "Chat", [], selections), undefined)
  assert.equal(chatPet("server\nchat", "Chat", pets, selections), pets[2])
})
test("saved selections survive a storage round trip without changing Home preferences", () => {
  const preferences = { selected: "byte", size: 96, roam: true, enabled: true }
  const selections: ChatPetSelections = {}
  selectChatPet(selections, "server\nchat", "iron")
  const restored = JSON.parse(JSON.stringify(selections)) as ChatPetSelections
  assert.equal(chatPet("server\nchat", "Chat", pets, restored), pets[2])
  assert.equal(preferences.selected, "byte")
})
