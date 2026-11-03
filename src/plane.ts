import { createSignal, onCleanup, onMount } from "solid-js"
import { composerPlane } from "./layout"
import { findPetAnchor } from "./anchor"

export function createPetPlane() {
  const [bottom, setBottom] = createSignal(12)
  const [width, setWidth] = createSignal(window.innerWidth)
  onMount(() => {
    const selector = '[data-component="session-composer-dock"], [data-component="dock-prompt"], [data-component="composer"]'
    let pending: ReturnType<typeof setTimeout> | undefined
    let observed: Element | undefined
    const ancestors = new Set<Element>()
    const resize = new ResizeObserver(() => schedule())
    const measure = () => {
      pending = undefined
      setWidth(innerWidth)
      ancestors.clear()
      for (const dock of document.querySelectorAll(selector)) {
        for (let element: Element | null = dock; element; element = element.parentElement) ancestors.add(element)
      }
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
    const schedule = () => { if (pending === undefined) pending = setTimeout(measure, 100) }
    const containsAnchor = (node: Node) => node instanceof Element && (node.matches(selector) || !!node.querySelector(selector))
    const mutations = new MutationObserver(records => {
      // Streaming text, syntax highlighting and pet animation do not move the dock.
      // Watch insertion/removal of docks and visibility changes on their ancestors.
      if (records.some(record => {
        if (!(record.target instanceof Element) || record.target.closest(".oc-pets")) return false
        if (record.type === "attributes") return ancestors.has(record.target) || record.target.matches(selector)
        return [...record.addedNodes, ...record.removedNodes].some(containsAnchor)
      })) schedule()
    })
    mutations.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "class", "hidden"] })
    window.addEventListener("resize", schedule)
    window.addEventListener("scroll", schedule, true)
    measure()
    onCleanup(() => { clearTimeout(pending); resize.disconnect(); mutations.disconnect(); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true) })
  })
  return { bottom, width }
}
