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
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const el = ev.target.closest && ev.target.closest('[data-action][role="button"]');
    if (!el) return;
    ev.preventDefault();
    const fn = actions[el.dataset.action];
    if (fn) fn(el);
  });
}
