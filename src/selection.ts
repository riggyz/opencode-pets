import { sessionPet } from "./layout"
import type { Pet } from "./pet"

export type ChatPetSelections = Record<string, string>

// Keys include the server and root session ID, never the mutable chat title.
export function chatPet(key: string, title: string, pets: readonly Pet[], selections: ChatPetSelections) {
  return pets.find(pet => pet.key === selections[key]) ?? sessionPet(title, pets)
}

export function selectChatPet(selections: ChatPetSelections, key: string, pet: string | undefined) {
  if (pet) selections[key] = pet
  else delete selections[key]
}
