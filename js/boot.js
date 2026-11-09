/* Stash: entry point. Loaded as a deferred module; the anti-flash palette
   script is the inline #theme-preload in index.html. */
"use strict";

import { initTheme, applyPalette } from "./theme.js";
import { initTopBar, showTopBar } from "./top-bar.js";
import { renderGate } from "./gate.js";
import { store } from "./store.js";
import { github } from "../github.js";
import { loadScope, targetsPath } from "./data.js";
import { buildView } from "./view-model.js";
import { render, searchResultsHtml, searchVm } from "./render.js";
import { wire } from "./wire.js";

initTheme();
github.setToken(store.state.settings.token);

/* loaded: newest result for loadedScope (null = nothing to show yet).
   good: { scope, loaded } for the last ok result; render() keeps it on screen
   through a transient failure or a refresh in flight. */
const env = { tab: "overview", selected: null, scope: store.state.settings.me || "hugo", loaded: null, loadedScope: null,
              good: null, settings: store.state.settings, buildView, targetsPath };

/* Until a token unlocks it, only the gate shows (gate.js), as Ladle and Compass. */
const GATE = {
  check: async (t) => {
    const was = store.state.settings.token;
    github.setToken(t);
    try { await github.getFile(".claude-plugin/marketplace.json"); return true; }
    catch { github.setToken(was); return false; }
  },
  save: (t) => { store.setSetting("token", t); github.setToken(t); env.loaded = null; env.loadedScope = null; env.good = null; paint(); load(); },
  who: (w) => { store.setSetting("me", w); env.scope = w; env.selected = null; env.loaded = null; env.loadedScope = null; paint(); load(); },
  palette: (p) => { store.setSetting("palette", p); applyPalette(p); paint(); },
};
function paint(opts) {
  env.settings = store.state.settings;
  if (renderGate(env.settings, GATE)) return;
  /* the chart opens on the latest month and keeps its place across repaints */
  const was = document.querySelector(".cb-scroll"), left = was ? was.scrollLeft : null;
  render(env, opts);
  const sc = document.querySelector(".cb-scroll");
  if (sc) sc.scrollLeft = left == null ? sc.scrollWidth : left;
}
/* A background load must not rebuild Settings: the token field may hold
   something typed and not yet saved. */
function paintBackground() { paint({ keepView: env.tab === "settings" }); }

async function load() {
  const scope = env.scope, token = store.state.settings.token;
  /* only drop the shown result when the scope changed; a refresh of the same
     scope keeps the last good data up until the new answer arrives */
  if (env.loadedScope !== scope) { env.loaded = null; env.loadedScope = scope; }
  paintBackground();
  if (!store.hasToken() || !store.state.settings.me) return;
  const loaded = await loadScope(github, scope);
  if (scope !== env.scope || token !== store.state.settings.token) return;
  /* a token GitHub rejects locks the app again: back to the gate, as Ladle */
  if (loaded.status === "unauthorized") { store.setSetting("token", ""); github.setToken(""); env.good = null; env.loaded = null; paint(); return; }
  env.loaded = loaded;
  if (loaded.status === "ok") env.good = { scope, loaded };
  paintBackground();
}

/* The drawer and the search view are layers: each opens with a history entry,
   so the phone's back gesture closes it (Material, and as Ladle), and closing
   it by hand walks that entry back. */
let layer = null; // "menu" | "search" | null, the one with a history entry
function pushLayer(name) { if (layer) return; layer = name; try { history.pushState({ stash: name }, ""); } catch { layer = null; } }
function popLayer(name) { if (layer === name) { layer = null; history.back(); } }
function hideMenu() { document.getElementById("drawer").hidden = true; document.getElementById("drawerScrim").hidden = true; }
function hideSearch() { document.getElementById("searchPage").hidden = true; }
function closeMenu() { hideMenu(); popLayer("menu"); }
window.addEventListener("popstate", () => { const was = layer; layer = null; if (was === "menu") hideMenu(); if (was === "search") hideSearch(); });
function closeSearch() { hideSearch(); popLayer("search"); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMenu(); closeSearch(); } });
/* search filters as you type: only the results redraw, so the field (and the
   phone's keyboard) stay as they are */
document.addEventListener("input", (e) => {
  if (e.target.id !== "searchInput") return;
  env.query = e.target.value;
  const box = document.getElementById("searchResults");
  if (box) box.innerHTML = searchResultsHtml(searchVm(env), env.query);
});

wire({
  tab: (el) => { env.tab = el.dataset.tab; closeMenu(); paint(); window.scrollTo(0, 0); showTopBar(true); },
  menu: () => { const d = document.getElementById("drawer"); document.getElementById("drawerScrim").hidden = false; d.hidden = false; pushLayer("menu"); (d.querySelector(".m3-drawer__item") || d).focus(); },
  "close-menu": () => closeMenu(),
  search: () => {
    closeMenu();
    const page = document.getElementById("searchPage"), i = document.getElementById("searchInput");
    page.hidden = false;
    pushLayer("search");
    document.getElementById("searchResults").innerHTML = searchResultsHtml(searchVm(env), i.value);
    i.focus();
  },
  "close-search": () => closeSearch(),
  scope: (el) => { env.scope = el.dataset.scope; env.selected = null; load(); },
  "period-pick": (el) => { env.selected = env.selected === el.dataset.key ? null : el.dataset.key; paint(); },
  who: (el) => {
    store.setSetting("me", el.dataset.who); env.scope = el.dataset.who; env.selected = null;
    env.loaded = null; env.loadedScope = null; paint(); load();
  },
  palette: (el) => { store.setSetting("palette", el.dataset.palette); applyPalette(el.dataset.palette); paint(); },
  "save-token": () => {
    const v = document.getElementById("tokenInput").value.trim();
    store.setSetting("token", v); github.setToken(v); env.tab = "overview";
    /* a new token can see different things: forget what the old one loaded */
    env.loaded = null; env.loadedScope = null; env.good = null; load();
  },
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
initTopBar();
load();

/* Never register on localhost: the dev server sends no-store and an old worker
   would keep serving a cached shell. The worker itself is a kill switch there. */
if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.register("service-worker.js");
}
