/** Section ids on the home page that the header nav jumps to. */
export type HomeSection = "top" | "samples";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scroll the home page to a section quickly and reliably.
 * "top" also focuses the question box so the user can type straight away.
 */
export function scrollToHomeSection(section: HomeSection) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

  if (section === "top") {
    window.history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior });
    document.getElementById("question")?.focus({ preventScroll: true });
    return;
  }

  const el = document.getElementById(section);
  if (!el) return;
  window.history.replaceState(null, "", `/#${section}`);
  el.scrollIntoView({ behavior, block: "start" });
}
