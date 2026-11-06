/* Stash: entry point. Loaded as a deferred module; the anti-flash palette
   script is the inline #theme-preload in index.html. */
"use strict";

import { initTheme, applyPalette } from "./theme.js";
import { initTopBar, showTopBar } from "./top-bar.js";
import { store } from "./store.js";
import { github } from "../github.js";
import { loadScope, targetsPath } from "./data.js";
import { buildView } from "./view-model.js";
import { render, searchResultsHtml } from "./render.js";
import { wire } from "./wire.js";

initTheme();
github.setToken(store.state.settings.token);

/* loaded: newest result for loadedScope (null = nothing to show yet).
   good: { scope, loaded } for the last ok result; render() keeps it on screen
   through a transient failure or a refresh in flight. */
const env = { tab: "overview", scope: store.state.settings.me || "hugo", loaded: null, loadedScope: null,
              good: null, settings: store.state.settings, buildView, targetsPath };

function paint(opts) { env.settings = store.state.settings; render(env, opts); }
/* A background load must not rebuild Settings: the token field may hold
   something typed and not yet saved. */
function paintBackground() { paint({ keepView: env.tab === "settings" || env.tab === "search" }); }

async function load() {
  const scope = env.scope, token = store.state.settings.token;
  /* only drop the shown result when the scope changed; a refresh of the same
     scope keeps the last good data up until the new answer arrives */
  if (env.loadedScope !== scope) { env.loaded = null; env.loadedScope = scope; }
  paintBackground();
  if (!store.hasToken() || !store.state.settings.me) return;
  const loaded = await loadScope(github, scope);
  if (scope !== env.scope || token !== store.state.settings.token) return;
  env.loaded = loaded;
  if (loaded.status === "ok") env.good = { scope, loaded };
  paintBackground();
}

function closeMenu() { document.getElementById("drawer").hidden = true; document.getElementById("drawerScrim").hidden = true; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
/* search filters as you type: only the results redraw, so the field (and the
   phone's keyboard) stay as they are */
document.addEventListener("input", (e) => {
  if (e.target.id !== "searchInput") return;
  env.query = e.target.value;
  const box = document.getElementById("searchResults");
  if (box) box.innerHTML = searchResultsHtml(env.searchVm, env.query);
});

wire({
  tab: (el) => { env.tab = el.dataset.tab; closeMenu(); paint(); window.scrollTo(0, 0); showTopBar(true); },
  menu: () => { const d = document.getElementById("drawer"); document.getElementById("drawerScrim").hidden = false; d.hidden = false; (d.querySelector(".m3-drawer__item") || d).focus(); },
  "close-menu": () => closeMenu(),
  search: () => { env.tab = "search"; closeMenu(); paint(); const i = document.getElementById("searchInput"); if (i) i.focus(); },
  scope: (el) => { env.scope = el.dataset.scope; load(); },
  who: (el) => {
    store.setSetting("me", el.dataset.who); env.scope = el.dataset.who;
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
