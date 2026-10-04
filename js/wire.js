/* Stash: one delegated click handler. Nothing is attached per element, so a
   re-render never loses a listener. */
"use strict";

export function wire(actions) {
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el);
  });
}
