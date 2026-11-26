/**
 * Scrolls `container` just enough to show the element matching `selector` inside it.
 * Unlike `Element.scrollIntoView`, this never scrolls the page itself, which would push the board
 * off the screen in the mobile layout.
 */
export function scrollIntoContainer(container: HTMLElement | null, selector: string, smooth: boolean) {
  const el = container?.querySelector<HTMLElement>(selector);
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const margin = 8;
  // Show the top of the element when it is taller than the container.
  const delta = r.top < c.top ? r.top - c.top - margin : r.bottom > c.bottom ? Math.min(r.bottom - c.bottom + margin, r.top - c.top - margin) : 0;
  if (delta !== 0) container.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
}
