import assert from "node:assert/strict"
import { test } from "node:test"
import { babyPetSize, collectSessions, departureStep, followerTarget, guestPosition, reconcileColony as reconcileGuests, sessionCandidates, sessionKey, sessionPill, sessionProject, sessionRoot, type SessionPet, type SessionSource } from "./sessions"
import { initialActivity } from "./activity"

function source(input: {
  sessions?: { id: string; parentID?: string; title?: string; agent?: string; outcome?: string; time: { idle?: number; viewed?: number; archived?: number } }[]
  running?: string[]
  permissions?: string[]
  forms?: string[]
}): SessionSource {
  return {
    list: () => input.sessions ?? [],
    get: id => input.sessions?.find(info => info.id === id),
    active: () => input.running ?? [],
    status: id => input.running?.includes(id) ? "running" : "idle",
    permission: { sessions: () => input.permissions ?? [], list: id => input.permissions?.includes(id) ? [{}] : [] },
    form: { sessions: () => input.forms ?? [], list: id => input.forms?.includes(id) ? [{}] : [] },
  }
}
const session = (id: string, activity: SessionPet["activity"] = "running", server = "local"): SessionPet => ({ key: sessionKey(server, id), server, id, title: id, agent: "Build", activity, project: "skills", subagents: [] })

test("groups running and prompted subagents under their parent rather than spawning pets", () => {
  const result = collectSessions("local", source({
    sessions: [{ id: "root", title: "Root", agent: "Explore", time: {} }, ...["child", "approval", "question"].map(id => ({ id, parentID: "root", time: {} }))],
    running: ["root", "child"], permissions: ["approval"], forms: ["question"],
  }), {}, 100)
  assert.deepEqual(result.map(item => [item.id, item.activity, item.subagents.map(child => child.id)]), [["root", "waiting", ["child", "approval", "question"]]])
  assert.deepEqual(result[0].subagents.map(child => child.activity), ["running", "waiting", "waiting"])
  assert.equal(result[0].agent, "Explore")
})
test("Desktop's unhydrated permission/form lists may be undefined despite SDK declarations", () => {
  const data = source({ sessions: [{ id: "not-hydrated", time: {} }], running: ["not-hydrated"] })
  data.permission.list = () => undefined
  data.form.list = () => undefined
  assert.deepEqual(collectSessions("local", data, {}, 0).map(item => [item.id, item.activity]), [["not-hydrated", "running"]])
})
test("does not resurrect viewed historical failures/completions or archived sessions", () => {
  const result = collectSessions("local", source({ sessions: [
    { id: "old-error", outcome: "failed", time: { idle: 10, viewed: 20 } },
    { id: "old-reply", outcome: "succeeded", time: { idle: 10, viewed: 20 } },
    { id: "new-reply", outcome: "succeeded", time: { idle: 30, viewed: 20 } },
    { id: "archived", outcome: "failed", time: { idle: 30, archived: 40 } },
  ] }), {}, 100)
  assert.deepEqual(result.map(item => [item.id, item.activity]), [["old-error", "idle"], ["old-reply", "idle"], ["new-reply", "review"]])
})
test("live errors and acknowledgement are session-scoped; attention beats temporary error reactions", () => {
  const data = source({ sessions: ["one", "two"].map(id => ({ id, time: {} })), running: ["one", "two"], forms: ["two"] })
  const states = { one: { ...initialActivity, failureUntil: 200 }, two: { ...initialActivity, failureUntil: 200 } }
  assert.deepEqual(collectSessions("local", data, states, 100).map(item => item.activity), ["failed", "waiting"])
  assert.deepEqual(collectSessions("local", data, { ...states, one: initialActivity }, 100).map(item => item.activity), ["running", "waiting"])
  assert.deepEqual(collectSessions("local", data, states, 201).map(item => item.activity), ["running", "waiting"])
})
test("nested active descendants become babies of the root; finished children disappear", () => {
  const sessions = [{ id: "root", time: {} }, { id: "child", parentID: "root", time: {} }, { id: "nested", parentID: "child", time: {} }]
  for (const running of [["child", "nested"], ["nested"], []]) {
    const data = source({ sessions, running })
    const result = collectSessions("local", data, {}, 0)
    assert.equal(result.length, 1)
    assert.equal(result[0].id, "root")
    assert.deepEqual(result[0].subagents.map(child => child.id), running)
    assert.equal(sessionRoot(data, "nested"), "root")
  }
  assert.equal(babyPetSize(96), 53)
})
test("cold metadata never flashes a subagent pet; missing ancestors become hydration candidates", () => {
  const data = source({ running: ["child"] })
  assert.deepEqual(collectSessions("local", data, {}, 0), [])
  data.get = id => id === "child" ? { id, parentID: "parent", time: {} } : undefined
  assert.deepEqual([...sessionCandidates(data, {})], ["child", "parent"])
  assert.deepEqual(collectSessions("local", data, {}, 0), [])
  data.get = id => id === "child" ? { id, parentID: "parent", time: {} } : { id, time: {} }
  assert.deepEqual(collectSessions("local", data, {}, 0).map(item => [item.id, item.subagents.length]), [["parent", 1]])
})
test("archived descendants neither create babies nor propagate waiting", () => {
  const data = source({ sessions: [{ id: "root", time: {} }, { id: "child", parentID: "root", time: { archived: 1 } }], running: ["child"], forms: ["child"] })
  const [parent] = collectSessions("local", data, {}, 0)
  assert.equal(parent.subagents.length, 0)
  assert.equal(parent.activity, "idle")
})
test("hover pills shorten session titles to 16 characters and keep the project separate", () => {
  assert.deepEqual(sessionPill("Short chat", "skills"), { title: "Short chat", project: "skills" })
  assert.deepEqual(sessionPill("a".repeat(40), "skills"), { title: `${"a".repeat(16)}…`, project: "skills" })
  assert.deepEqual(sessionPill("🐱".repeat(29), "skills"), { title: `${"🐱".repeat(16)}…`, project: "skills" })
  assert.equal(sessionProject({ id: "one", projectID: "project", location: { directory: "/src/fallback/" }, time: {} }, () => "Project name"), "Project name")
  assert.equal(sessionProject({ id: "one", location: { directory: "/src/fallback/" }, time: {} }), "fallback")
  assert.equal(sessionProject({ id: "one", time: {} }), "No project")
})
test("babies trail their parent in either direction and remain on screen near edges", () => {
  assert.equal(followerTarget(800, 96, 1, 0, 1000), 800 - babyPetSize(96) * .55)
  assert.equal(followerTarget(100, 96, -1, 0, 1000), 196 - babyPetSize(96) * .45)
  assert.ok(followerTarget(800, 96, 1, 0, 1000) < 800)
  assert.ok(followerTarget(100, 96, -1, 0, 1000) > 153)
  assert.ok(followerTarget(800, 96, 1, 1, 1000) < followerTarget(800, 96, 1, 0, 1000))
  const gap = followerTarget(100, 96, -1, 1, 1000) - followerTarget(100, 96, -1, 0, 1000)
  assert.ok(gap > 0 && gap < babyPetSize(96))
  for (const x of [0, 100, 904]) for (const heading of [-1, 1]) for (let index = 0; index < 8; index++) {
    const target = followerTarget(x, 96, heading, index, 1000)
    assert.ok(target >= 0 && target + babyPetSize(96) <= 1000)
    assert.ok(target + babyPetSize(96) <= 1000 / 3 || target >= 2000 / 3)
  }
})
test("one family per active/current session, keeping server IDs distinct", () => {
  const resident = session("one")
  const guests = reconcileGuests([], [resident, session("two"), session("three", "waiting"), session("four", "idle"), session("two", "review", "remote")], resident.key)
  assert.deepEqual(guests.map(item => item.session.key), ["local\none", "local\ntwo", "local\nthree", "remote\ntwo"])
  assert.ok(guests.every(item => !item.leaving))
})
test("idle/disconnected/deleted guests depart; new work cancels departure without duplicating them", () => {
  const worker = session("worker")
  const arrived = reconcileGuests([], [worker])
  const idle = reconcileGuests(arrived, [{ ...worker, activity: "idle" }])
  assert.equal(idle.length, 1)
  assert.equal(idle[0].leaving, true)
  const resumed = reconcileGuests(idle, [{ ...worker, activity: "waiting" }])
  assert.equal(resumed.length, 1)
  assert.equal(resumed[0].leaving, false)
  assert.equal(resumed[0].session.activity, "waiting")
  assert.equal(reconcileGuests(resumed, [])[0].leaving, true)
})
test("changing current chat preserves family ordering and identity without promotion/remount", () => {
  const main = session("main")
  const worker = session("worker")
  const before = reconcileGuests([], [main, worker], main.key)
  const after = reconcileGuests(before, [main, worker], worker.key)
  assert.deepEqual(after.map(item => item.session.key), [main.key, worker.key])
  assert.equal(after[0].session, before[0].session)
  assert.equal(after[1].session, before[1].session)
  assert.equal(after[0].leaving, false)
})
test("guest updates preserve ordering instead of remounting/moving unrelated guests", () => {
  const before = reconcileGuests([], [session("one"), session("two")])
  const after = reconcileGuests(before, [session("two", "review"), session("one", "waiting"), session("three")])
  assert.deepEqual(after.map(item => item.session.id), ["one", "two", "three"])
  assert.deepEqual(after.map(item => item.session.activity), ["waiting", "review", "running"])
})
test("guest home positions are spread out and within the window", () => {
  for (const width of [320, 800, 1440]) {
    for (const count of [1, 2, 8]) {
      const positions = Array.from({ length: count }, (_, index) => guestPosition(index, count, width, 96))
      assert.ok(positions.every(x => x >= 0 && x + 96 <= width))
      assert.equal(new Set(positions).size, count)
    }
  }
})
test("departure walks toward the nearest edge and finishes fully outside the viewport", () => {
  for (const start of [100, 600]) {
    let x = start
    let done = false
    for (let tick = 0; tick < 200 && !done; tick++) {
      const step = departureStep(x, 800, 96, 50)
      assert.equal(step.action, start < 400 ? "running-left" : "running-right")
      x = step.x
      done = step.done
    }
    assert.ok(done)
    assert.ok(x + 96 < 0 || x > 800)
  }
})
