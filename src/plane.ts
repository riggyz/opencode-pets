import { createSignal, onCleanup, onMount } from "solid-js"
import { composerPlane } from "./layout"
import { findPetAnchor } from "./anchor"

export function createPetPlane() {
  const [bottom, setBottom] = createSignal(12)
  const [width, setWidth] = createSignal(window.innerWidth)
  onMount(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    let observed: Element | undefined
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      pending = undefined
      setWidth(innerWidth)
      // Cached chats stay mounted; select only the visible input dock, including
      // question and permission prompts which replace the normal composer.
      const anchor = findPetAnchor(selector => document.querySelectorAll<HTMLElement>(selector), innerHeight)
      if (anchor !== observed) {
        resize.disconnect()
        if (anchor) resize.observe(anchor)
        observed = anchor
      }
      setBottom(composerPlane(anchor?.getBoundingClientRect().top, innerHeight))
    }
    // Coalesce DOM changes without relying on animation frames: embedded Review
    // surfaces can suspend rAF even while reporting document.hidden === false.
    const schedule = () => { if (pending === undefined) pending = setTimeout(measure, 0) }
    const mutations = new MutationObserver(records => {
      // Pet animation changes styles every frame; never let those drive layout reads.
      if (records.some(record => !(record.target instanceof Element) || !record.target.closest(".oc-pets"))) schedule()
    })
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] })
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)
    measure()
    onCleanup(() => { clearTimeout(pending); resize.disconnect(); mutations.disconnect(); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true) })
  })
  return { bottom, width }
}
