interface Anchor {
  checkVisibility(): boolean
  getBoundingClientRect(): { top: number; bottom: number; width: number; height: number }
}

export function findPetAnchor<T extends Anchor>(query: (selector: string) => Iterable<T>, height: number): T | undefined {
  // The outer dock survives composer/question/permission morphs. Observing it
  // also follows animated height changes instead of dropping to the window edge.
  for (const selector of ['[data-component="session-composer-dock"]', '[data-component="dock-prompt"], [data-component="composer"]']) {
    for (const element of query(selector)) {
      const rect = element.getBoundingClientRect()
      if (element.checkVisibility() && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < height) return element
    }
  }
}
