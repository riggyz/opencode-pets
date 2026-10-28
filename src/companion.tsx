import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { actionLabels, animationFrame, companionAction, frameDurations, lookDirection, lookPosition, rowCount, spritePosition, type Action, type Catalog, type Pet } from "./pet"
import { babyPetSize, departureStep, followerTarget, guestPosition, sessionPill, type SessionBaby } from "./sessions"
import { babyHop, laneBounds, lanePosition } from "./layout"

export interface Preferences {
  enabled: boolean
  selected: string
  size: number
  roam: boolean
}

export function Companion(props: {
  pets: Pet[]
  preferences: Preferences
  update: (change: Partial<Preferences>) => void
  activity: Action
  label?: string
  pill?: { title: string; project: string }
  bottom?: number
  homeIndex?: number
  autoPet?: boolean
  openParent?: () => void
  babies?: SessionBaby[]
  follow?: { x: number; size: number; heading: number; index: number; count: number }
  sessionKey?: string
  guest?: { index: number; count: number; leaving: boolean }
  activate?: () => void
  departed?: () => void
  refresh: () => Promise<Catalog>
}) {
  const [elapsed, setElapsed] = createSignal(0)
  const [hop, setHop] = createSignal(0)
  const target = () => props.follow ? followerTarget(props.follow.x, props.follow.size, props.follow.heading, props.follow.index, width(), props.follow.count) : x()
  const [x, setX] = createSignal(props.follow ? followerTarget(props.follow.x, props.follow.size, props.follow.heading, props.follow.index, window.innerWidth, props.follow.count) : guestPosition(props.homeIndex ?? 0, props.guest?.count ?? 1, window.innerWidth, props.preferences.size))
  const [width, setWidth] = createSignal(window.innerWidth)
  const pillWidth = () => Math.min(160, width() - 16)
  const [heading, setHeading] = createSignal(-1)
  const [hovered, setHovered] = createSignal(false)
  const [reduced, setReduced] = createSignal(false)
  const [visible, setVisible] = createSignal(!document.hidden)
  const [menu, setMenu] = createSignal(false)
  const [play, setPlay] = createSignal<Action>()
  const [walking, setWalking] = createSignal<Action>()
  const [errors, setErrors] = createSignal<string[]>([])
  const [loading, setLoading] = createSignal(false)
  const [imageError, setImageError] = createSignal("")
  const [pointer, setPointer] = createSignal<{ x: number; y: number; at: number }>()
  const [looking, setLooking] = createSignal(false)
  const pet = createMemo(() => props.pets.find(p => p.key === props.preferences.selected) ?? props.pets[0])
  const action = createMemo(() => props.guest?.leaving ? departureStep(x(), width(), props.preferences.size, 0).action : props.follow ? play() ?? walking() ?? props.activity : companionAction(props.activity, play(), walking()))
  const babyKeys = createMemo(() => (props.babies ?? []).map(baby => baby.key))
  let lastX = x()
  createEffect(() => {
    const next = x()
    if (next !== lastX) setHeading(next > lastX ? 1 : -1)
    lastX = next
  })
  createEffect(() => { if (props.follow && reduced()) setX(target()) })
  createEffect(() => {
    const viewport = width()
    const size = props.preferences.size
    if (!props.guest?.leaving) setX(value => lanePosition(value, viewport, size))
  })
  const look = () => {
    const point = pointer()
    if (!point || !looking() || reduced() || action() !== "idle" || pet()?.spriteVersionNumber !== 2) return undefined
    return lookDirection(point.x - x() - props.preferences.size / 2, point.y - (window.innerHeight - (props.bottom ?? 12) - props.preferences.size * 208 / 192 * .65), props.preferences.size / 4)
  }
  const status = () => look() !== undefined ? "Looking" : actionLabels[action()]
  let drag: { start: number; origin: number; moved: boolean } | undefined
  let suppressClick = false
  let direction = -1
  let roamTime = 0
  let reset: ReturnType<typeof setTimeout> | undefined

  const react = (next: Action) => {
    clearTimeout(reset)
    setElapsed(0)
    setPlay(next)
    reset = setTimeout(() => setPlay(undefined), frameDurations[next].reduce((a, b) => a + b, 0))
  }
  createEffect(() => { action(); setElapsed(0) })
  const hoverPet = () => { if (!drag && !props.guest?.leaving) react("jumping") }
  const refresh = async () => {
    setLoading(true)
    try { setErrors((await props.refresh()).errors) }
    catch (error) { setErrors([error instanceof Error ? error.message : String(error)]) }
    finally { setLoading(false) }
  }

  onMount(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)")
    const resize = () => setWidth(window.innerWidth)
    const motionChanged = () => setReduced(motion.matches)
    const visibility = () => setVisible(!document.hidden)
    const pointerMoved = (event: PointerEvent) => {
      if (motion.matches || drag || event.pointerType === "touch") return
      setPointer({ x: event.clientX, y: event.clientY, at: performance.now() })
      setLooking(true)
    }
    const pointerLeft = () => { setPointer(undefined); setLooking(false) }
    motionChanged()
    motion.addEventListener("change", motionChanged)
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("pointermove", pointerMoved, { passive: true })
    document.addEventListener("pointerleave", pointerLeft)
    let previous = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(200, now - previous)
      previous = now
      if (!visible() || !props.preferences.enabled) return
      if (props.follow) {
        setHop(reduced() ? 0 : babyHop(now, props.follow.index))
        const distance = target() - x()
        if (reduced()) { setX(target()); setWalking(undefined); return }
        setElapsed(value => value + delta)
        if (Math.abs(distance) < 1 || hovered()) { setWalking(undefined); return }
        setX(x() + Math.sign(distance) * Math.min(Math.abs(distance), delta * .14))
        setWalking(distance > 0 ? "running-right" : "running-left")
        return
      }
      if (props.guest?.leaving) {
        if (reduced()) { props.departed?.(); return }
        setElapsed(value => value + delta)
        const step = departureStep(x(), width(), props.preferences.size, delta)
        setX(step.x)
        if (step.done) props.departed?.()
        return
      }
      if (reduced()) return
      setElapsed(value => value + delta)
      roamTime += delta
      const point = pointer()
      const following = pet()?.spriteVersionNumber === 2 && !!point && now - point.at < 1500
      setLooking(following)
      if (props.guest || !props.preferences.roam || menu() || drag || play() || following || props.activity !== "idle") {
        setWalking(undefined)
        return
      }
      // Short walks, with pauses between them. No work while hidden or reduced-motion.
      if (roamTime % 12500 >= 6000) { setWalking(undefined); return }
      const bounds = laneBounds(x(), width(), props.preferences.size)
      const next = Math.max(bounds.min, Math.min(bounds.max, x() + direction * delta * .024))
      if (next === x()) direction *= -1
      setX(next)
      setWalking(direction === 1 ? "running-right" : "running-left")
    }, 50)
    if (props.activity === "idle") react("waving")
    onCleanup(() => {
      clearInterval(timer)
      clearTimeout(reset)
      motion.removeEventListener("change", motionChanged)
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("pointermove", pointerMoved)
      document.removeEventListener("pointerleave", pointerLeft)
    })
  })

  return <Show when={props.preferences.enabled && pet()}>{current =>
    <div class="oc-pets" data-action={action()} data-activity={props.activity} data-pet={current().id} data-look={look()} data-session={props.sessionKey} data-guest={!!props.guest} data-baby={!!props.follow} data-leaving={!!props.guest?.leaving}
      style={{ left: `${props.guest?.leaving ? x() : lanePosition(x(), width(), props.preferences.size)}px`, bottom: `${props.bottom ?? 12}px`, width: `${props.preferences.size}px`, "--hop": `${hop()}px` }}>
      <Show when={hovered() && !menu()}>
        <span class="oc-pets-pill" role="tooltip" style={{ "max-width": `${pillWidth()}px`, left: `${Math.max(8 + pillWidth() / 2, Math.min(width() - pillWidth() / 2 - 8, x() + props.preferences.size / 2)) - x()}px` }}>
          <span>{props.pill?.title || props.label || current().displayName}</span>
          <Show when={props.pill?.project}><small>{props.pill!.project}</small></Show>
        </span>
      </Show>
      <Show when={menu()}>
        <section class="oc-pets-menu" aria-label="Pet settings" style={{ left: `${Math.min(0, width() - x() - 284)}px` }} onKeyDown={event => { if (event.key === "Escape") setMenu(false) }}>
          <div class="oc-pets-heading"><strong>{props.guest ? "Guest session" : "Pets"}</strong><button aria-label="Close pet settings" onClick={() => setMenu(false)}>×</button></div>
          <p>{props.label}</p>
          <p role="status">State: {actionLabels[props.activity]}{status() !== actionLabels[props.activity] ? ` · ${status()}` : ""}</p>
          <Show when={!props.guest}>
          <Show when={!props.autoPet} fallback={<p>Companion assigned from this session's name.</p>}>
          <label>Companion<select value={current().key} onChange={event => { props.update({ selected: event.currentTarget.value }); setImageError("") }}>
            <For each={props.pets}>{item => <option value={item.key}>{item.displayName}</option>}</For>
          </select></label>
          </Show>
          <p>{current().description}</p>
          <label>Size <input aria-label="Pet size" type="range" min="64" max="160" step="8" value={props.preferences.size} onInput={event => props.update({ size: Number(event.currentTarget.value) })} /></label>
           <label class="oc-pets-check"><input type="checkbox" checked={props.preferences.roam} onChange={event => props.update({ roam: event.currentTarget.checked })} /> Wander along the side lanes</label>
          <div class="oc-pets-actions"><button disabled={loading()} onClick={() => void refresh()}>{loading() ? "Refreshing…" : "Refresh pets"}</button><button onClick={() => props.update({ enabled: false })}>Hide pet</button></div>
          </Show>
          <Show when={props.guest}><button onClick={() => props.activate?.()}>Open session</button></Show>
          <button onClick={() => react("waving")}>Say hello</button>
          <small>Hover to pet · drag to move<br />{props.guest ? "Click to open this session." : "Click to dismiss completed/error state."}</small>
          <Show when={imageError()}><p role="alert">{imageError()}</p></Show>
          <For each={errors()}>{error => <p role="alert">{error}</p>}</For>
        </section>
      </Show>
      <button class="oc-pets-sprite" aria-label={props.follow ? `Subagent: ${props.label}` : props.guest ? `Open session: ${props.label}` : `Pet ${current().displayName}: ${props.label || "Your companion"}`} disabled={props.guest?.leaving}
        style={{ width: `${props.preferences.size}px`, height: `${props.preferences.size * 208 / 192}px`, "background-image": `url("${current().image}")`, "background-size": `800% ${rowCount(current().spriteVersionNumber) * 100}%`, "background-position": look() !== undefined ? lookPosition(look()!) : spritePosition(action(), reduced() ? 0 : animationFrame(action(), elapsed()), current().spriteVersionNumber) }}
        onContextMenu={event => { event.preventDefault(); if (!props.follow) setMenu(value => !value) }}
        onPointerEnter={() => { setHovered(true); hoverPet() }} onPointerLeave={() => setHovered(false)}
        onFocus={() => { setHovered(true); hoverPet() }} onBlur={() => setHovered(false)}
        onKeyDown={event => {
          if (event.key === "Escape") setMenu(false)
          if (event.key === "Enter" || event.key === " ") suppressClick = false
        }}
        onPointerDown={event => {
          if (event.button !== 0 || props.follow) return
          suppressClick = false
          drag = { start: event.clientX, origin: x(), moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => {
          if (!drag) return
          const delta = event.clientX - drag.start
          if (Math.abs(delta) > 4) drag.moved = true
          if (drag.moved) setX(lanePosition(drag.origin + delta, width(), props.preferences.size))
        }}
        onPointerUp={event => {
          suppressClick = !!drag?.moved
          drag = undefined
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => { drag = undefined; suppressClick = true }}
        onClick={() => { const suppressed = suppressClick; suppressClick = false; if (!suppressed) props.activate?.() }}
      />
      <Show when={!props.follow}><button class="oc-pets-settings" aria-label="Open pet settings" aria-expanded={menu()} onClick={() => setMenu(value => !value)}>···</button></Show>
      <img class="oc-pets-probe" alt="" src={current().image} onLoad={event => {
        const image = event.currentTarget
        if (image.naturalWidth !== 1536 || image.naturalHeight !== rowCount(current().spriteVersionNumber) * 208) setImageError("Invalid atlas dimensions: expected 1536 × " + rowCount(current().spriteVersionNumber) * 208)
      }} onError={() => setImageError("Could not decode the pet spritesheet")} />
      <For each={babyKeys()}>{(key, index) => {
        const initial = props.babies!.find(baby => baby.key === key)!
        const baby = () => props.babies?.find(baby => baby.key === key) ?? initial
        return <Companion pets={props.pets} preferences={{ ...props.preferences, size: babyPetSize(props.preferences.size), roam: false }}
          activity={baby().activity} sessionKey={key} label={`${baby().title} · ${baby().project}`} pill={sessionPill(baby().title, baby().project)}
          follow={{ x: x(), size: props.preferences.size, heading: heading(), index: index(), count: babyKeys().length }}
          bottom={props.bottom} update={props.update} refresh={props.refresh} activate={props.openParent ?? props.activate} />
      }}</For>
    </div>
  }</Show>
}
