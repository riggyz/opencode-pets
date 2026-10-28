import { render } from "solid-js/web"
import { batch, createSignal, For } from "solid-js"
import { Colony } from "./colony"
import type { Preferences } from "./companion"
import type { SessionPet } from "./sessions"
import { actionLabels, actions, type Action, type Pet } from "./pet"
import image from "../assets/byte/spritesheet.png?inline"
import "./pets.css"

// Renders the real colony with independently controllable session fixtures.
function Preview() {
  const [prefs, setPrefs] = createSignal<Preferences>({ enabled: true, selected: "builtin:byte", size: 96, roam: true })
  const [current, setCurrent] = createSignal("preview\nmain")
  const [composerHeight, setComposerHeight] = createSignal(110)
  const [inputKind, setInputKind] = createSignal("composer")
  const [sessions, setSessions] = createSignal<SessionPet[]>([
    { key: "preview\nmain", server: "preview", id: "main", title: "Current chat", agent: "Build", activity: "running", project: "skills", subagents: [] },
    { key: "preview\nworker", server: "preview", id: "worker", title: "Background worker", agent: "Build", activity: "running", project: "sample-app", subagents: [] },
    { key: "preview\nquestion", server: "preview", id: "question", title: "Waiting for approval", agent: "Build", activity: "waiting", project: "skills", subagents: [] },
  ])
  const update = (key: string, activity: Action) => setSessions(value => value.map(session => session.key === key ? { ...session, activity } : session))
  let nextChild = 0
  const acknowledge = (session: SessionPet) => {
    if (session.activity === "review" || session.activity === "failed") update(session.key, "idle")
  }
  const pet: Pet = { key: "builtin:byte", source: "Built in", id: "byte", displayName: "Byte", description: "An original little charcoal cat with mint eyes.", spriteVersionNumber: 1, spritesheetPath: "spritesheet.png", image }
  return <>
    <main style="max-width:640px;margin:10vh auto;padding:24px">
      <p style="color:#83ceae;font-size:12px;letter-spacing:2px">OPENCODE PETS · COLONY PREVIEW</p>
      <h1 style="font-weight:500;font-size:28px">A little company while you code.</h1>
      <p style="color:#9296a0;line-height:1.7">Hover to pet. Click a guest to open its chat. Idle guests walk off the screen; working and attention states stay.</p>
      <p data-testid="current-session">Viewing: {sessions().find(session => session.key === current())?.title ?? "Home"}</p>
      <For each={["preview\nmain", "preview\nworker", "preview\nquestion"]}>{key => {
        const session = () => sessions().find(item => item.key === key)!
        return <label style="display:block;margin:12px 0">{session().title} <select aria-label={session().title} value={session().activity} onChange={event => update(key, event.currentTarget.value as Action)}>
          <For each={actions}>{action => <option value={action}>{actionLabels[action]}</option>}</For>
        </select></label>
      }}</For>
      <button onClick={() => setCurrent("preview\nmain")}>View current chat</button>
      <button onClick={() => setCurrent("")}>Home</button>
      <button onClick={() => setSessions(value => value.map(session => {
        if (session.key !== current()) return session
        const id = `child-${++nextChild}`
        return { ...session, subagents: [...session.subagents, { key: `preview\n${id}`, server: "preview", id, title: `Research task ${nextChild}: investigate a long session title`, agent: "Explore", activity: "running", project: session.project }] }
      }))}>Start subagent</button>
      <button onClick={() => setSessions(value => value.map(session => session.key === current() ? { ...session, subagents: session.subagents.slice(0, -1) } : session))}>Finish subagent</button>
      <button onClick={() => setPrefs(value => ({ ...value, enabled: !value.enabled }))}>{prefs().enabled ? "Hide pets" : "Show pets"}</button>
      <button onClick={() => setComposerHeight(value => value === 110 ? 210 : 110)}>Resize composer</button>
      <For each={["composer", "question", "permission"]}>{kind => <button onClick={() => setInputKind(kind)}>Show {kind}</button>}</For>
    </main>
    <div data-component="session-composer-dock" style={{ position: "fixed", bottom: "16px", left: "35%", width: "30%" }}>
      <div data-component={inputKind() === "composer" ? "composer" : "dock-prompt"} data-kind={inputKind()} style={{ height: `${composerHeight() + (inputKind() === "question" ? 100 : inputKind() === "permission" ? 40 : 0)}px`, border: "1px solid #ffffff30", "border-radius": "12px", background: "#24262b" }}>
        <p style="padding:12px;color:#9296a0">{inputKind()} fixture · center stays clear</p>
      </div>
    </div>
    <Colony pets={[pet]} preferences={prefs()} update={change => setPrefs(value => ({ ...value, ...change }))}
      sessions={sessions()} residentKey={current()} acknowledge={acknowledge}
      open={session => batch(() => { acknowledge(session); setCurrent(session.key) })}
      refresh={async () => ({ pets: [pet], errors: [] })} />
  </>
}
render(() => <Preview />, document.getElementById("app")!)
