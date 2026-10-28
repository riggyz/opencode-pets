import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { Companion, type Preferences } from "./companion"
import { reconcileColony, sessionPill, type GuestPet, type SessionPet } from "./sessions"
import { sessionPet } from "./layout"
import { createPetPlane } from "./plane"
import type { Catalog, Pet } from "./pet"

export function Colony(props: {
  pets: Pet[]
  preferences: Preferences
  update: (change: Partial<Preferences>) => void
  refresh: () => Promise<Catalog>
  sessions: SessionPet[]
  residentKey?: string
  acknowledge: (session: SessionPet) => void
  open: (session: SessionPet) => void
}) {
  const [families, setFamilies] = createSignal<GuestPet[]>([])
  const plane = createPetPlane()
  const preferences = () => ({ ...props.preferences, size: Math.min(props.preferences.size, plane.width() / 3) })
  createEffect(() => {
    const sessions = props.sessions
    const current = props.residentKey
    setFamilies(previous => reconcileColony(previous, sessions, current))
  })
  // A family never changes its keyed component when it becomes the current chat.
  // Its position, hover state, animation, and babies stay in the global layout.
  const keys = createMemo(() => families().map(family => family.session.key))
  return <>
    <Show when={!props.residentKey && !keys().length}>
      <Companion pets={props.pets} preferences={preferences()} bottom={plane.bottom()} update={props.update} refresh={props.refresh} activity="idle" label="Your companion" />
    </Show>
    <For each={keys()}>{(key, index) => {
      const initial = families().find(item => item.session.key === key)!
      const family = () => families().find(item => item.session.key === key) ?? initial
      const current = () => props.residentKey === key
      const assignedPreferences = () => ({ ...preferences(), selected: sessionPet(family().session.title, props.pets)?.key ?? props.preferences.selected })
      return <Companion pets={props.pets} preferences={assignedPreferences()} bottom={plane.bottom()} autoPet homeIndex={index()}
        babies={family().leaving ? [] : family().session.subagents} pill={sessionPill(family().session.title, family().session.project)}
        activity={family().session.activity} sessionKey={key} label={`${family().session.title} · ${family().session.project}`}
        guest={current() && !family().leaving ? undefined : { index: index(), count: families().length, leaving: family().leaving }}
        update={props.update} refresh={props.refresh}
        activate={() => { if (current()) props.acknowledge(family().session); else props.open(family().session) }}
        openParent={() => props.open(family().session)}
        departed={() => setFamilies(previous => previous.filter(item => item.session.key !== key || !item.leaving))} />
    }}</For>
  </>
}
