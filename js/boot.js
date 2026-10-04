/* Stash: entry point. Loaded as a deferred module; the anti-flash palette
   script is the inline #theme-preload in index.html. */
"use strict";

import { initTheme } from "./theme.js";
import { store } from "./store.js";
import { github } from "../github.js";
import { loadScope, targetsPath } from "./data.js";
import { buildView } from "./view-model.js";
import { render } from "./render.js";
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
  env.loaded = loaded;
  if (loaded.status === "ok") env.good = { scope, loaded };
  paintBackground();
}

wire({
  tab: (el) => { env.tab = el.dataset.tab; paint(); },
  scope: (el) => { env.scope = el.dataset.scope; load(); },
  who: (el) => {
    store.setSetting("me", el.dataset.who); env.scope = el.dataset.who;
    env.loaded = null; env.loadedScope = null; paint(); load();
  },
  "save-token": () => {
    const v = document.getElementById("tokenInput").value.trim();
    store.setSetting("token", v); github.setToken(v); env.tab = "overview";
    /* a new token can see different things: forget what the old one loaded */
    env.loaded = null; env.loadedScope = null; env.good = null; load();
  },
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
load();

/* Never register on localhost: the dev server sends no-store and an old worker
   would keep serving a cached shell. The worker itself is a kill switch there. */
if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.register("service-worker.js");
}
