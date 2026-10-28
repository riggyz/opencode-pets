import { Command, createKeyed, Plugin, Slot, Store, Style } from "@opencode/plugin/gui"
import { Schema } from "effect"
import { createEffect, createMemo, createSignal, mapArray, onCleanup, onMount, Show } from "solid-js"
import { homedir } from "node:os"
import { join } from "node:path"
import { Colony } from "./colony"
import { Pets } from "./contract"
import { loadCatalog } from "./catalog"
import { initialActivity, reduceActivity, type ActivityState } from "./activity"
import { collectSessions, sessionCandidates, sessionKey, sessionRoot, type SessionPet } from "./sessions"
import type { Pet } from "./pet"
import image from "../assets/byte/spritesheet.png?inline"
import css from "./pets.css?inline"

const byte: Pet = {
  key: "builtin:byte", source: "Built in", id: "byte", displayName: "Byte",
  description: "A little charcoal cat with mint eyes.", spriteVersionNumber: 1,
  spritesheetPath: "spritesheet.png", image,
}

export default Plugin.define({
  stores: {
    prefs: Store.global(Schema.Struct({ enabled: Schema.Boolean, selected: Schema.String, size: Schema.Number, roam: Schema.Boolean }), { enabled: true, selected: "builtin:byte", size: 96, roam: true }),
  },
  setup(ctx) {
    const [pets, setPets] = createSignal<Pet[]>([byte])
    const prefs = ctx.stores.prefs
    const refresh = async () => {
      const catalog = await ctx.main(Pets).list()
      if (!ctx.signal.aborted) setPets([byte, ...catalog.pets])
      return { pets: [...catalog.pets], errors: [...catalog.errors] }
    }
    void refresh().catch(error => console.warn("Pets: could not read custom pets", error))
    const allowed = () => !ctx.options.onlyDirectory || ctx.sessions.current()?.directory === ctx.options.onlyDirectory
    const [byServer, setByServer] = createSignal<Record<string, SessionPet[]>>({})
    const acknowledgers = new Map<string, (id: string) => void>()
    const servers = mapArray(() => ctx.servers.list(), serverID => {
      createKeyed(() => {
        const server = ctx.servers.get(serverID)
        return server?.connected ? server.data : undefined
      }, data => {
        const [states, setStates] = createSignal<Record<string, ActivityState>>({})
        const expiry = new Map<string, ReturnType<typeof setTimeout>>()
        const controller = new AbortController()
        const requested = new Set<string>()
        createEffect(() => {
          const candidates = sessionCandidates(data.session, states())
          const current = ctx.sessions.current()
          if (current?.server.id === serverID) candidates.add(current.id)
          for (const id of candidates) {
            if (data.session.get(id) || requested.has(id)) continue
            const server = ctx.servers.get(serverID)
            if (!server) continue
            requested.add(id)
            void server.client.session.get({ sessionID: id }, { signal: controller.signal }).then(info => {
              if (!controller.signal.aborted) data.session.remember(info)
            }).catch(() => { /* Deleted/unavailable sessions must not break the colony. */ })
          }
        })
        acknowledgers.set(serverID, id => {
          const family = [...sessionCandidates(data.session, states())].filter(child => sessionRoot(data.session, child) === id)
          for (const child of family) { clearTimeout(expiry.get(child)); expiry.delete(child) }
          setStates(previous => ({ ...previous, ...Object.fromEntries(family.map(child => [child, initialActivity])) }))
        })
        createEffect(() => {
          const sessions = collectSessions(serverID, data.session, states(), Date.now(), id => {
            const project = data.project.get(id)
            return project?.name || project?.canonical.replace(/\\/g, "/").split("/").filter(Boolean).at(-1)
          })
          setByServer(previous => ({ ...previous, [serverID]: sessions }))
        })
        const unsubscribe = data.listen(({ details }) => {
          if (!details.data || typeof details.data !== "object" || !("sessionID" in details.data) || typeof details.data.sessionID !== "string") return
          const id = details.data.sessionID
          const previous = states()[id] ?? initialActivity
          const next = reduceActivity(previous, details, id, Date.now())
          if (next === previous) return
          clearTimeout(expiry.get(id))
          expiry.delete(id)
          setStates(value => ({ ...value, [id]: next }))
          if (next.failureUntil > Date.now()) expiry.set(id, setTimeout(() => {
            expiry.delete(id)
            setStates(value => ({ ...value, [id]: { ...(value[id] ?? initialActivity), failureUntil: 0 } }))
          }, next.failureUntil - Date.now()))
        })
        onCleanup(() => {
          controller.abort()
          unsubscribe()
          expiry.forEach(clearTimeout)
          acknowledgers.delete(serverID)
          setByServer(previous => { const next = { ...previous }; delete next[serverID]; return next })
        })
      })
      return serverID
    })
    createEffect(() => { servers() })
    const sessions = createMemo(() => Object.values(byServer()).flat())
    const residentKey = () => {
      const current = ctx.sessions.current()
      return current ? sessionKey(current.server.id, sessionRoot(current.server.data.session, current.id)) : undefined
    }
    const acknowledge = (session: SessionPet) => acknowledgers.get(session.server)?.(session.id)
    ctx.add(Style, css)
    ctx.add(Command, () => ({
      id: "toggle", title: prefs.value.enabled ? "Hide pet" : "Show pet", keywords: "pets companion cat", enabled: allowed(),
      run: () => prefs.update(draft => { draft.enabled = !draft.enabled }),
    }))
    ctx.add(Command, () => ({ id: "refresh", title: "Refresh pets", enabled: allowed(), run: async () => { await refresh() } }))
    ctx.add(Slot, { at: "window.bottom", render: () => {
      onMount(() => {
        const frame = requestAnimationFrame(() => {
          const sprites = [...document.querySelectorAll<HTMLElement>(".oc-pets")].map(element => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return { activity: element.dataset.activity, pet: element.dataset.pet, guest: element.dataset.guest, baby: element.dataset.baby, left: rect.left, bottom: style.bottom, width: rect.width, height: rect.height, onscreen: rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight && style.display !== "none" && style.visibility !== "hidden" }
          })
          console.info("[riggyz-pets] Desktop render check", JSON.stringify({ enabled: prefs.value.enabled, allowed: allowed(), sprites }))
        })
        onCleanup(() => cancelAnimationFrame(frame))
      })
      return <Show when={allowed() && prefs.value.enabled}>
        <Colony pets={pets()} preferences={prefs.value} sessions={sessions()} residentKey={residentKey()}
          acknowledge={acknowledge} open={session => { acknowledge(session); ctx.tabs.open({ server: session.server, id: session.id }, { focus: true }) }}
          update={change => prefs.update(draft => { Object.assign(draft, change) })} refresh={refresh} />
      </Show>
    } })
  },
  main(ctx) {
    const home = homedir()
    const extra = Array.isArray(ctx.options.directories) ? ctx.options.directories.filter((path): path is string => typeof path === "string") : []
    const directories = [join(process.env.CODEX_HOME || join(home, ".codex"), "pets"), join(home, ".petdex", "pets"), join(process.env.XDG_CONFIG_HOME || join(home, ".config"), "opencode", "pets"), ...extra.map(path => path.startsWith("~/") ? join(home, path.slice(2)) : path)]
    ctx.provide(Pets, { list: () => loadCatalog(directories) })
    ctx.log.write("info", "Pets main loaded")
  },
})
