import assert from "node:assert/strict"
import { test } from "node:test"
import { activityAction, initialActivity, reduceActivity, restoreActivity } from "./activity"

const sessionID = "ses_pet"
const event = (type: string, data: Record<string, unknown> = {}) => ({ type, data: { sessionID, ...data } })

test("reload/reconnect never mistakes an earlier run's outcome for the active run", () => {
  const failed = { outcome: "failed", time: { idle: 100, viewed: 100 } }
  const completed = { outcome: "succeeded", time: { idle: 100, viewed: 50 } }
  assert.equal(restoreActivity(failed, true), initialActivity)
  assert.equal(restoreActivity(completed, true), initialActivity)
  assert.equal(restoreActivity(undefined, false), initialActivity)
  assert.equal(restoreActivity(failed, false).outcome, "failed")
  assert.equal(restoreActivity(completed, false).outcome, "review")
  assert.equal(restoreActivity({ ...completed, time: { idle: 100, viewed: 100 } }, false), initialActivity)
})

test("session completion selects review; new work and interruption clear it", () => {
  const completed = reduceActivity(initialActivity, event("session.execution.succeeded"), sessionID, 100)
  assert.equal(activityAction(completed, false, false, 100), "review")
  assert.equal(activityAction(completed, false, true, 100), "running")
  for (const type of ["session.execution.started", "session.execution.interrupted"]) {
    assert.deepEqual(reduceActivity(completed, event(type), sessionID, 100), initialActivity)
  }
})
test("terminal errors persist, but questions and permissions always take priority", () => {
  const failed = reduceActivity(initialActivity, event("session.execution.failed"), sessionID, 100)
  assert.equal(activityAction(failed, false, false, 100000), "failed")
  assert.equal(activityAction(failed, true, true, 101), "waiting")
  assert.deepEqual(reduceActivity(failed, event("session.execution.started"), sessionID, 102), initialActivity)
})
test("tool/step failures react briefly and resume work, without declaring the session failed", () => {
  for (const type of ["session.tool.failed", "session.step.failed"]) {
    const failed = reduceActivity(initialActivity, event(type), sessionID, 100)
    assert.equal(activityAction(failed, false, true, 101), "failed")
    assert.equal(activityAction(failed, false, true, 4100), "running")
    assert.equal(activityAction(failed, false, false, 4100), "idle")
    assert.equal(activityAction(failed, true, true, 101), "waiting")
  }
})
test("nonzero shell exits, signals and timeouts react even when the tool invocation succeeded", () => {
  for (const metadata of [{ exit: 1 }, { exit: 2 }, { exit: -1 }, { timeout: true }, { signal: "SIGTERM" }]) {
    const state = reduceActivity(initialActivity, event("session.tool.success", { metadata }), sessionID, 100)
    assert.equal(activityAction(state, false, true, 101), "failed")
  }
  for (const metadata of [undefined, {}, { exit: 0 }, { status: "running" }, { exit: "1" }]) {
    assert.equal(reduceActivity(initialActivity, event("session.tool.success", { metadata }), sessionID, 100), initialActivity)
  }
})
test("brief errors do not hide a subsequent successful completion after their reaction expires", () => {
  const failed = reduceActivity(initialActivity, event("session.tool.failed"), sessionID, 100)
  const completed = reduceActivity(failed, event("session.execution.succeeded"), sessionID, 200)
  assert.equal(activityAction(completed, false, false, 201), "failed")
  assert.equal(activityAction(completed, false, false, 4100), "review")
})
test("events from other sessions, malformed data and unrelated events leave activity untouched", () => {
  for (const e of [event("session.execution.failed", { sessionID: "ses_other" }), { type: "session.execution.failed", data: null }, { type: "session.execution.failed", data: {} }, event("session.text.delta")]) {
    assert.equal(reduceActivity(initialActivity, e, sessionID, 0), initialActivity)
  }
})
test("viewing, archiving or deleting a session clears its pet attention state", () => {
  for (const type of ["session.viewed", "session.archived", "session.deleted"]) {
    assert.deepEqual(reduceActivity({ outcome: "review", failureUntil: 100 }, event(type), sessionID, 0), initialActivity)
  }
})
