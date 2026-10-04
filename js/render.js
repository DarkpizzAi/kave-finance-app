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
  return `<div class="card who"><h2>Who is looking?</h2>
    <p class="sub">Stash opens on your own view. You can change this in Settings.</p>
    <div class="row"><button class="btn" data-action="who" data-who="hugo">Hugo</button>
    <button class="btn" data-action="who" data-who="isa">Isa</button></div></div>`;
}

export function scopesHtml(current, me) {
  return ["hugo", "isa", "household"].map((s) => {
    const label = NAMES[s] + (s === me ? " (you)" : "");
    return `<button role="tab" class="scope" data-action="scope" data-scope="${s}" aria-selected="${s === current}">${esc(label)}</button>`;
  }).join("");
}

function chips(vm, ctx, me) {
  const out = [];
  if (vm.kind) out.push(`<span class="chip">${vm.kind === "salary-cycle" ? "salary cycles" : "calendar months"}</span>`);
  if (vm.stale) out.push(`<span class="chip warn">${esc(String(vm.stale.days))} days old</span>`);
  else if (vm.generated) out.push(`<span class="chip">updated ${esc(vm.generated.slice(0, 10))}</span>`);
  if (me && ctx.scope !== me && ctx.scope !== "household") out.push(`<span class="chip">viewing another person, read only</span>`);
  return out.length ? `<div class="meta">${out.join("")}</div>` : "";
}

function kpisHtml(k, ctx) {
  if (!k) {
    return `<div class="kpis">${["Safe to spend / month", "Typical income", "Savings target", "Recurring targets"]
      .map((l) => `<div class="kpi none"><small>${l}</small><b>No target set</b><em>add it in ${esc(ctx.targetsFile)}</em></div>`).join("")}</div>`;
  }
  return `<div class="kpis">
    <div class="kpi hero"><small>Safe to spend / month</small><b>${formatEur(k.safe)}</b><em>after savings and recurring targets</em></div>
    <div class="kpi"><small>Typical income</small><b>${formatEur(k.income)}</b><em>committed typical figure</em></div>
    <div class="kpi"><small>Savings target</small><b>${formatEur(k.savings)}</b><em>${k.expected ? "per month, " + formatEur(k.expected) + " counted" : "per month, computed from the goal"}</em></div>
    <div class="kpi"><small>Recurring targets</small><b>${formatEur(k.recurring)}</b><em>rent, groceries, subscriptions</em></div></div>`;
}

function goalHtml(g) {
  if (!g) return "";
  return `<div class="card"><h2>Goal progress</h2>
    <div class="track"><div class="seg-saved" style="width:${g.pctSaved}%"></div><div class="seg-pend" style="width:${g.pctExpected}%"></div></div>
    <p class="sub">${formatEur(g.saved)} saved + ${formatEur(g.expected)} on its way = ${formatEur(g.total)} of ${formatEur(g.goal)} (${g.pctTotal}%), ${g.months} months to go</p></div>`;
}

function chartHtml(vm) {
  if (!vm.months.length) return `<div class="empty">No months yet.</div>`;
  const mx = Math.max(...vm.months.map((m) => m.spend), 1);
  const bars = vm.months.map((m, i) => {
    /* a refund-heavy month can total below zero: draw no bar, keep its label */
    const h = Math.max(0, m.spend / mx * 110), x = 20 + i * 66;
    return `<rect x="${x}" y="${125 - h}" width="40" height="${h}" fill="var(--accent)"/>` +
      `<text x="${x + 20}" y="140" text-anchor="middle">${esc(m.label.slice(2))}</text>` +
      `<text x="${x + 20}" y="${120 - h}" text-anchor="middle">${formatEur(m.spend)}</text>`;
  }).join("");
  return `<div class="sub">Spend by month, one-offs excluded</div><svg viewBox="0 0 ${20 + vm.months.length * 66} 150" role="img" aria-label="Spend by month">${bars}</svg>`;
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
    <div class="two"><div class="card"><h2>Where it went</h2>${chartHtml(vm)}${oneOffsHtml(vm.oneOffs)}</div>
    <div class="card">${catsHtml(vm)}</div></div>`;
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
  return `${warn}<div class="card"><h2>GitHub token</h2>
    <p class="sub">Read access to the private hub repo. It stays on this device.</p>
    <div class="row"><input id="tokenInput" type="password" autocomplete="off" value="${esc(tokenDraft == null ? settings.token : tokenDraft)}" aria-label="GitHub token">
    <button class="btn" data-action="save-token">Save</button></div></div>
    <div class="card"><h2>Who are you?</h2>
    <div class="row"><button class="btn" data-action="who" data-who="hugo" aria-pressed="${settings.me === "hugo"}">Hugo</button>
    <button class="btn" data-action="who" data-who="isa" aria-pressed="${settings.me === "isa"}">Isa</button></div></div>`;
}

export function navHtml(tab) {
  return ["overview", "settings"].map((t) =>
    `<button class="navbtn" data-action="tab" data-tab="${t}" aria-current="${t === tab}">${t === "overview" ? "Overview" : "Settings"}</button>`).join("");
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
  const view = document.getElementById("view");
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
