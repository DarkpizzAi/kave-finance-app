/* Stash: palette and colour-scheme handling.

   The token values are NOT here. They live in m3/kave-m3-tokens.css, generated
   in kave-hub (brand/tools/make_m3_tokens.py). This module only decides
   which palette is selected and keeps the browser's colour-scheme in step.

   Light or dark follows the OS and nothing else. There is deliberately no
   in-app override: [data-theme] exists in the tokens file as an internal
   read mechanism, not as a user setting. */
"use strict";

import { store } from "./store.js";

/* The two household themes (Isa, 05/11/2026), on Material 3 since 06/11/2026.
   data-seed drives the kit's tokens (m3/kave-m3-tokens.css); data-palette is
   kept for older readers. #theme-preload in index.html repeats this (it runs
   before modules load); change both, then recompute its hash. A retired
   palette (amber, lime, tangerine, volt) reads as Cobalt. */
export const PALETTES = {
  cobalt: "Cobalt",
  chartreuse: "Chartreuse",
};

export function darkNow() {
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

/* Tell the browser which way the page leans. This is what darkens the Android
   gesture bar; the status bar at the top is the phone's own and takes no
   instruction from us. The tokens also declare color-scheme, but an
   installed app can outlive a token change, so the app states it too. */
export function syncColorScheme() {
  document.documentElement.style.colorScheme = darkNow() ? "dark" : "light";
}

export function applyPalette(palette) {
  const root = document.documentElement;
  if (PALETTES[palette] && palette !== "cobalt") { root.setAttribute("data-palette", palette); root.setAttribute("data-seed", palette); }
  else { root.removeAttribute("data-palette"); root.removeAttribute("data-seed"); }
  syncColorScheme();
}

export function initTheme() {
  applyPalette(store.state.settings.palette);
  /* The OS can flip while the app is open, and an installed PWA is often
     open for days. Without this the app keeps the scheme it booted with. */
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncColorScheme);
}

/* Did the inline #theme-preload script in index.html actually run? If the CSP
   hash stops matching, that script is blocked SILENTLY - the only symptom
   would be a flash of the wrong palette on load. It stamps data-theme-boot
   before doing anything else, so its absence is the tell, and Settings says
   so out loud rather than leaving it to be noticed. */
export function themeBootRan() {
  return document.documentElement.dataset.themeBoot === "1";
}
