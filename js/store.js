/* Stash: persisted state. One settings object under the stash.* prefix.
   The hub's embed writes token, me and palette into this same key. */
"use strict";

export const LS_SETTINGS = "stash.settings";

const DEFAULTS = { token: "", palette: "cobalt", theme: "system", me: "" };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    /* private window, blocked storage or corrupt JSON: start from defaults */
    return { ...fallback };
  }
}

export const store = {
  state: { settings: read(LS_SETTINGS, DEFAULTS) },
  listeners: [],
  subscribe(fn) { this.listeners.push(fn); },
  notify() { for (const fn of this.listeners) fn(); },
  setSetting(key, value) {
    this.state.settings[key] = value;
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(this.state.settings)); }
    catch { /* quota or blocked storage: works for this session */ }
    this.notify();
  },
  hasToken() { return !!this.state.settings.token; },
};
