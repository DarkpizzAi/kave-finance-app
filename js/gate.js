/* Stash: the first-run gate, the twin of Ladle's and Compass's (Isa,
   06/11/2026: "it should be just the field to add the token and the token
   unlocks the app"). Without a token nothing of the app shows: a Material
   basic dialog with the wordmark, the token field and the accent button. A
   token that cannot read the hub repo just clears the field. After a fresh
   token, two one-tap steps in the same look: who, then which theme.

   While the gate is up, body.gated hides the rest of the app (styles.css).
   The Settings token field stays for replacing a token; clearing it there
   brings the gate back. Pure HTML builders, no DOM until renderGate. */
"use strict";

import { PALETTES } from "./theme.js";
import { enterLayer } from "../m3/kave-m3.js";

/* true between a fresh token and the theme pick, this session only */
let fresh = false;
export const setFresh = (v) => { fresh = v; };

export function gateStep(settings) {
  if (!settings.token) return "token";
  if (!settings.me) return "who";
  return fresh ? "theme" : null;
}

const ARROW = '<span class="m3-icon" aria-hidden="true">arrow_forward</span>';
const MARK = '<h2 class="gate-mark m3-headline-s">Stash</h2>';
/* Each theme's primary, read from the kit tokens, as Ladle's gate. */
function accents() {
  const root = document.documentElement, prev = root.getAttribute("data-seed"), out = {};
  for (const id of Object.keys(PALETTES)) {
    if (id === "cobalt") root.removeAttribute("data-seed"); else root.setAttribute("data-seed", id);
    out[id] = getComputedStyle(root).getPropertyValue("--md-sys-color-primary").trim();
  }
  if (prev === null) root.removeAttribute("data-seed"); else root.setAttribute("data-seed", prev);
  return out;
}

export function gateHtml(step) {
  const open = '<div class="gate-box m3-dialog m3-dialog--basic" role="dialog" aria-modal="true" aria-label="Stash">';
  if (step === "token") {
    return `${open}${MARK}<div class="gate-field m3-field">`
      + '<span class="m3-field__label">Access</span>'
      + '<input id="gateToken" class="m3-field__input" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Access" data-1p-ignore data-lpignore="true"></div>'
      + `<div class="m3-dialog__actions"><button type="button" class="gate-go m3-btn m3-btn--filled" id="gateGo" aria-label="Connect">${ARROW}</button></div></div>`;
  }
  if (step === "who") {
    return `${open}${MARK}<div class="setup-row">`
      + '<button type="button" class="setup-choice m3-btn m3-btn--tonal" data-gate-who="isa">Isa</button>'
      + '<button type="button" class="setup-choice m3-btn m3-btn--tonal" data-gate-who="hugo">Hugo</button></div></div>';
  }
  const acc = typeof document === "undefined" ? {} : accents();
  return `${open}${MARK}<div class="setup-row">${Object.keys(PALETTES).map((id) =>
    `<button type="button" class="setup-swatch m3-swatch" data-gate-palette="${id}" aria-label="${PALETTES[id]}" style="--kave-k:${acc[id] || ""}"></button>`).join("")}</div></div>`;
}

/* Draws the gate, or hides it. Returns true while the app is gated.
   check(token) resolves true when the token can read the repo; save(token),
   who(name) and palette(id) store the answers; done() runs once unlocked. */
export function renderGate(settings, { check, save, who, palette }) {
  const step = gateStep(settings);
  const root = document.getElementById("gate");
  document.body.classList.toggle("gated", !!step);
  if (!step) { root.hidden = true; root.innerHTML = ""; root.dataset.step = ""; return false; }
  root.hidden = false;
  if (root.dataset.step === step) return true; // already drawn: keep what is typed
  root.dataset.step = step;
  root.innerHTML = gateHtml(step);
  enterLayer(root.querySelector(".gate-box"), "dialog"); // a dialog scales in from 85%, as Ladle's
  const input = document.getElementById("gateToken");
  if (input) {
    let busy = false;
    const submit = async () => {
      const candidate = input.value.trim();
      input.value = "";
      if (!candidate || busy) return;
      busy = true;
      const ok = await check(candidate).catch(() => false);
      busy = false;
      if (!ok) { input.focus(); return; }
      fresh = true;
      save(candidate);
    };
    document.getElementById("gateGo").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    input.focus();
  }
  root.querySelectorAll("[data-gate-who]").forEach((b) => b.addEventListener("click", () => who(b.dataset.gateWho)));
  root.querySelectorAll("[data-gate-palette]").forEach((b) => b.addEventListener("click", () => { fresh = false; palette(b.dataset.gatePalette); }));
  const first = root.querySelector(".setup-choice, .setup-swatch");
  if (first) first.focus();
  return true;
}
