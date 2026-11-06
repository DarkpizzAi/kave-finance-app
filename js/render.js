/* Stash: rendering. The *Html functions are pure string builders so they are
   tested without a DOM. Every dynamic string goes through escapeHtml. */
"use strict";

import { escapeHtml as esc } from "./util.js";
import { formatEur } from "./calc.js";
import { themeBootRan } from "./theme.js";

const NAMES = { hugo: "Hugo", isa: "Isa", household: "Household" };

const STATUS = {
  "no-token": (c) => `Add your GitHub token in <b>Settings</b> to load ${esc(NAMES[c.scope])}'s money.`,
  "unauthorized": () => "GitHub rejected the token. Check it in <b>Settings</b>.",
  "offline": () => "You are offline. Stash will load when you are back.",
  "rate-limited": () => "GitHub is rate limiting this device. Try again in a few minutes.",
  "error": () => "Something went wrong loading this view. Try again in a moment.",
  "no-access": () => "This token cannot see the household repo. Check its access in <b>Settings</b>.",
  "no-summary": (c) => c.scope === "household"
    ? "No summary published yet. The joint statement has not been imported, so nothing is shown rather than guessed."
    : `No summary published yet for ${esc(NAMES[c.scope])}.`,
};

export function statusHtml(status, ctx) {
  const msg = (STATUS[status] || STATUS.error)(ctx);
  return `<div class="note" role="status">${msg}</div>`;
}

export function whoHtml() {
  return `<div class="m3-card m3-card--elevated card who"><h2>Who is looking?</h2>
    <p class="sub">Stash opens on your own view. You can change this in Settings.</p>
    <div class="row"><button class="m3-chip" data-action="who" data-who="hugo">Hugo</button>
    <button class="m3-chip" data-action="who" data-who="isa">Isa</button></div></div>`;
}

export function scopesHtml(current, me) {
  return ["hugo", "isa", "household"].map((s) => {
    const label = NAMES[s] + (s === me ? " (you)" : "");
    return `<button role="tab" class="scope m3-chip${s === current ? " is-selected" : ""}" data-action="scope" data-scope="${s}" aria-selected="${s === current}">${esc(label)}</button>`;
  }).join("");
}

function chips(vm, ctx, me) {
  const out = [];
  if (vm.kind) out.push(`<span class="chip m3-chip">${vm.kind === "salary-cycle" ? "salary cycles" : "calendar months"}</span>`);
  if (vm.stale) out.push(`<span class="chip warn m3-chip">${esc(String(vm.stale.days))} days old</span>`);
  else if (vm.generated) out.push(`<span class="chip m3-chip">updated ${esc(vm.generated.slice(0, 10))}</span>`);
  if (me && ctx.scope !== me && ctx.scope !== "household") out.push(`<span class="chip m3-chip">viewing another person, read only</span>`);
  return out.length ? `<div class="meta">${out.join("")}</div>` : "";
}

function kpisHtml(k, ctx) {
  if (!k) {
    return `<div class="kpis">${["Safe to spend / month", "Typical income", "Savings target", "Recurring targets"]
      .map((l) => `<div class="m3-card m3-card--elevated kpi none"><small>${l}</small><b>No target set</b><em>add it in ${esc(ctx.targetsFile)}</em></div>`).join("")}</div>`;
  }
  return `<div class="kpis">
    <div class="kpi hero"><small>Safe to spend / month</small><b>${formatEur(k.safe)}</b><em>after savings and recurring targets</em></div>
    <div class="m3-card m3-card--elevated kpi"><small>Typical income</small><b>${formatEur(k.income)}</b><em>committed typical figure</em></div>
    <div class="m3-card m3-card--elevated kpi"><small>Savings target</small><b>${formatEur(k.savings)}</b><em>${k.expected ? "per month, " + formatEur(k.expected) + " counted" : "per month, computed from the goal"}</em></div>
    <div class="m3-card m3-card--elevated kpi"><small>Recurring targets</small><b>${formatEur(k.recurring)}</b><em>rent, groceries, subscriptions</em></div></div>`;
}

function goalHtml(g) {
  if (!g) return "";
  return `<div class="m3-card m3-card--elevated card"><h2>Goal progress</h2>
    <div class="track"><div class="seg-saved" style="width:${g.pctSaved}%"></div><div class="seg-pend" style="width:${g.pctExpected}%"></div></div>
    <p class="sub">${formatEur(g.saved)} saved + ${formatEur(g.expected)} on its way = ${formatEur(g.total)} of ${formatEur(g.goal)} (${g.pctTotal}%), ${g.months} months to go</p></div>`;
}

function chartHtml(vm) {
  if (!vm.months.length) return `<div class="empty">No months yet.</div>`;
  const mx = Math.max(...vm.months.map((m) => m.spend), 1);
  /* bars with 4px corners in the accent; the amount above and the month under
     each in Label small, at the same size on every screen (kave chart rules) */
  const bars = vm.months.map((m) => {
    /* a refund-heavy month can total below zero: draw no bar, keep its label */
    const pct = Math.max(0, m.spend / mx * 100);
    return `<div class="bc-col"><span class="m3-label-s bc-n">${formatEur(m.spend)}</span>` +
      `<span class="bc-bar" style="height:${pct.toFixed(1)}%"></span><span class="m3-label-s bc-l">${esc(m.label.slice(2))}</span></div>`;
  }).join("");
  return `<div class="sub">Spend by month, one-offs excluded</div><div class="bc" role="img" aria-label="Spend by month">${bars}</div>`;
}

function catsHtml(vm) {
  if (!vm.cats.length) return "";
  const mx = vm.cats[0].amount;
  return `<h2>${esc(vm.lastLabel)} by category</h2>` + vm.cats.map((c) =>
    `<div class="rank"><span>${esc(c.name)}</span><i><u style="width:${c.amount / mx * 100}%"></u></i><b>${formatEur(c.amount)}</b></div>`).join("");
}

function oneOffsHtml(list) {
  if (!list.length) return "";
  return `<div class="oneoff">${list.map((o) =>
    `<div class="oo">${esc(o.title)}<b>${formatEur(o.amount)}</b><span>${esc(o.description)}</span></div>`).join("")}</div>`;
}

export function overviewHtml(vm, ctx, me = "") {
  return `${chips(vm, ctx, me)}${kpisHtml(vm.kpis, ctx)}${goalHtml(vm.goal)}
    <div class="two"><div class="m3-card m3-card--elevated card"><h2>Where it went</h2>${chartHtml(vm)}${oneOffsHtml(vm.oneOffs)}</div>
    <div class="m3-card m3-card--elevated card pane">${catsHtml(vm)}</div></div>`;
}

/* Pure overview, with the status of a failed refresh on top. Used when the
   last good result for this scope is still on screen. */
export function staleOverviewHtml(status, ctx, vm, me = "") {
  return statusHtml(status, ctx) + `<p class="sub">Showing the last data that loaded.</p>` + overviewHtml(vm, ctx, me);
}

/* themeOk comes from themeBootRan() in theme.js, passed in so this stays pure.
   tokenDraft is what is typed in the token field but not saved yet. */
export function settingsHtml(settings, themeOk = true, tokenDraft = null) {
  const warn = themeOk ? "" :
    `<div class="note alert" role="alert">Theme preload BLOCKED: recompute the CSP hash (see README).</div>`;
  const pal = settings.palette === "chartreuse" ? "chartreuse" : "cobalt";
  const HEX = { cobalt: "#1a73e8", chartreuse: "#d7d63a" };
  const sw = (id, name) => `<button type="button" class="set-swatch" data-action="palette" data-palette="${id}" aria-pressed="${pal === id}" aria-label="${name}">` +
    `<span class="m3-swatch${pal === id ? " is-selected" : ""}" style="--kave-k:${HEX[id]}"><span class="m3-swatch__check m3-icon"${pal === id ? "" : " hidden"}>check</span></span>` +
    `<span class="m3-label-m">${name}</span></button>`;
  return `${warn}<div class="m3-list-header m3-title-s">Theme</div>
    <div class="m3-card m3-card--elevated card"><div class="set-swatches" role="group" aria-label="Theme colour">${sw("cobalt", "Cobalt")}${sw("chartreuse", "Chartreuse")}</div>
    <p class="sub">Light or dark follows the phone.</p></div>
    <div class="m3-list-header m3-title-s">Who are you?</div>
    <div class="m3-card m3-card--elevated card"><div class="row"><button class="m3-chip${settings.me === "hugo" ? " is-selected" : ""}" data-action="who" data-who="hugo" aria-pressed="${settings.me === "hugo"}">Hugo</button>
    <button class="m3-chip${settings.me === "isa" ? " is-selected" : ""}" data-action="who" data-who="isa" aria-pressed="${settings.me === "isa"}">Isa</button></div></div>
    <div class="m3-list-header m3-title-s">Advanced</div>
    <div class="m3-card m3-card--elevated card"><h2>GitHub token</h2>
    <p class="sub">Read access to the private hub repo. It stays on this device.</p>
    <div class="row"><label class="m3-field token-field"><span class="m3-field__label">GitHub token</span><input id="tokenInput" class="m3-field__input" type="password" autocomplete="off" value="${esc(tokenDraft == null ? settings.token : tokenDraft)}" aria-label="GitHub token"></label>
    <button class="m3-btn m3-btn--filled" data-action="save-token">Save</button></div></div>`;
}

/* Material 3 navigation, as Ladle and Compass: the menu button (top bar on the
   phone, top of the rail on wide screens) opens the drawer, which holds
   Settings (Settings is not a tab, spec section 7). Stash has one page,
   Overview, so the phone has no navigation bar. */
export const TITLES = { overview: "Overview", settings: "Settings" };
export function navHtml(tab) {
  return `<button type="button" class="m3-icon-btn" data-action="menu" aria-label="Menu"><span class="m3-icon">menu</span></button>` +
    `<div class="m3-rail__items"><button type="button" class="m3-rail__item${tab === "overview" ? " is-active" : ""}" data-action="tab" data-tab="overview" aria-current="${tab === "overview"}">` +
    `<span class="m3-rail__pill"><span class="m3-icon${tab === "overview" ? " m3-icon--fill" : ""}">savings</span></span><span class="m3-label-m">Overview</span></button></div>`;
}

export function drawerHtml(tab) {
  const item = (t, icon) => `<button type="button" class="m3-drawer__item${t === tab ? " is-active" : ""}" data-action="tab" data-tab="${t}">` +
    `<span class="m3-icon">${icon}</span><span class="m3-drawer__label">${TITLES[t]}</span></button>`;
  return `<div class="m3-drawer__head"><span class="m3-title-l">Kave Stash</span></div>${item("overview", "savings")}${item("settings", "settings")}`;
}

/* States the last good data survives. Anything else (rejected token, no
   access, no summary) is a definitive answer and replaces it. */
const TRANSIENT = ["offline", "rate-limited", "error"];

/* DOM painter.
   env = { tab, scope, loaded, good, settings, buildView, targetsPath }
   loaded is the newest result for the scope, or null while there is none.
   good is { scope, loaded } for the last ok result, kept so a failed refresh
   does not blank what the person was already reading.
   opts.keepView: repaint the scope tabs and nav only, and leave Settings
   alone (a typed but unsaved token must survive a background load). */
export function render(env, opts = {}) {
  const { tab, scope, loaded, settings } = env;
  const me = settings.me;
  document.getElementById("scopes").innerHTML = me ? scopesHtml(scope, me) : "";
  document.getElementById("nav").innerHTML = navHtml(tab);
  document.getElementById("drawer").innerHTML = drawerHtml(tab);
  document.getElementById("tabName").textContent = TITLES[tab] || "Stash";
  document.getElementById("scopes").hidden = tab !== "overview";
  const view = document.getElementById("view");
  view.dataset.tab = tab; /* overview: wide + skinny (1120); settings: one column (720) */
  if (tab === "settings") {
    if (opts.keepView) return;
    const field = document.getElementById("tokenInput");
    view.innerHTML = settingsHtml(settings, themeBootRan(), field ? field.value : null);
    return;
  }
  if (!me) { view.innerHTML = whoHtml(); return; }
  const ctx = { scope, targetsFile: env.targetsPath(scope) };
  if (!settings.token) { view.innerHTML = statusHtml("no-token", ctx); return; }
  const good = env.good && env.good.scope === scope ? env.good.loaded : null;
  const draw = (r) => env.buildView({ summary: r.summary, targets: r.targets });
  if (!loaded) {
    view.innerHTML = good ? overviewHtml(draw(good), ctx, me) : `<div class="note">Loading...</div>`;
    return;
  }
  if (loaded.status !== "ok") {
    view.innerHTML = good && TRANSIENT.includes(loaded.status)
      ? staleOverviewHtml(loaded.status, ctx, draw(good), me)
      : statusHtml(loaded.status, ctx);
    return;
  }
  view.innerHTML = overviewHtml(draw(loaded), ctx, me);
}
