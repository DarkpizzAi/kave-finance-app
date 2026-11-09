/* Stash: rendering. The *Html functions are pure string builders so they are
   tested without a DOM. Every dynamic string goes through escapeHtml. */
"use strict";

import { escapeHtml as esc } from "./util.js";
import { formatEur } from "./calc.js";
import { monthName } from "./period.js";
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

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
/* "2026-08" to "Aug"; a year (or any other label) is left as it is */
function ml(key) { return /^\d{4}-\d{2}$/.test(key) ? MON[+key.slice(5) - 1] : key; }

function chips(vm, ctx, me) {
  const out = [];
  if (vm.kind) out.push(`<span class="chip m3-chip">${vm.kind === "salary-cycle" ? "salary cycles" : "calendar months"}</span>`);
  if (vm.stale) out.push(`<span class="chip warn m3-chip">${esc(String(vm.stale.days))} days old</span>`);
  if (me && ctx.scope !== me && ctx.scope !== "household") out.push(`<span class="chip m3-chip">viewing another person, read only</span>`);
  return out.length ? `<div class="meta">${out.join("")}</div>` : "";
}

function kpisHtml(k, ctx) {
  const labels = ["Left after saving / month", "Typical income", "Savings target"];
  if (!k) {
    return `<div class="kpis">${labels
      .map((l) => `<div class="m3-card m3-card--elevated kpi none"><small>${l}</small><b>No target set</b><em>add it in ${esc(ctx.targetsFile)}</em></div>`).join("")}</div>`;
  }
  return `<div class="kpis">
    <div class="kpi hero"><small>${labels[0]}</small><b>${formatEur(k.left)}</b><em>income minus your savings target</em></div>
    <div class="m3-card m3-card--elevated kpi"><small>${labels[1]}</small><b>${formatEur(k.income)}</b><em>committed typical figure</em></div>
    <div class="m3-card m3-card--elevated kpi"><small>${labels[2]}</small><b>${formatEur(k.savings)}</b><em>${k.expected ? "per month, " + formatEur(k.expected) + " counted" : "per month, computed from the goal"}</em></div></div>`;
}

function goalHtml(g) {
  if (!g) return "";
  return `<div class="m3-card m3-card--elevated card"><h2>Savings goal</h2>
    <div class="track"><div class="seg-saved" style="width:${g.pctSaved}%"></div><div class="seg-pend" style="width:${g.pctExpected}%"></div></div>
    <p class="sub">${formatEur(g.saved)} saved + ${formatEur(g.expected)} on its way = ${formatEur(g.total)} of ${formatEur(g.goal)} (${g.pctTotal}%), ${g.months} months to go</p></div>`;
}

/* axis helpers: a rounded top, and "1k" style figures */
function niceMax(v) { return Math.max(500, Math.ceil(v / 500) * 500); }
function kfmt(v) { return Math.abs(v) >= 1000 ? (v / 1000) + "k" : String(v); }

/* Three lines (income, spent, saved) over every month on one horizontal
   scroll, a stepped monthly target, each line named at its right-hand end.
   Month groups carry data-key "YYYY-MM"; the "2026 >" labels carry "YYYY". */
function chartHtml(vm) {
  if (!vm.periods.length) return `<div class="empty">No months yet.</div>`;
  const per = vm.periods, step = 56, H = 300, T = 28, B = 44, W = per.length * step + 96;
  const tg = vm.mtargets || [];
  const vals = per.flatMap((m) => [m.spend, m.saved, m.income]).concat(tg);
  const mx = niceMax(Math.max(...vals)), mn = Math.min(0, Math.floor(Math.min(...vals) / 500) * 500);
  const y = (v) => T + (mx - v) / (mx - mn) * (H - T - B);
  const cx = (i) => step * i + step / 2 + 8;
  let grid = "", axis = "";
  for (let v = mn; v <= mx; v += 500) {
    const major = v % 1000 === 0, yy = y(v).toFixed(1);
    grid += `<line class="cb-grid${major ? " cb-grid--major" : ""}" x1="0" x2="${W}" y1="${yy}" y2="${yy}"/>`;
    axis += `<text class="cb-ax" x="36" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${major ? esc(kfmt(v)) : "·"}</text>`;
  }
  const year = vm.mode === "year";
  const curKey = vm.current ? vm.current.key : null;
  const isOn = (k) => curKey != null && (year ? k.startsWith(curKey + "-") : k === curKey);
  const band = per.map((m, i) => isOn(m.key)
    ? `<rect class="cb-band" x="${(cx(i) - step / 2).toFixed(1)}" y="${T - 12}" width="${step}" height="${H - T - B + 16}" rx="8"/>` : "").join("");
  const groups = per.map((m, i) => {
    const on = !year && isOn(m.key);
    return `<g data-action="period-pick" data-key="${esc(m.key)}" aria-pressed="${on}" role="button" tabindex="0" aria-label="${esc(monthName(m.key))} ${esc(m.key.slice(0, 4))}">` +
      `<rect class="cb-hit" x="${(cx(i) - step / 2).toFixed(1)}" y="0" width="${step}" height="${H - 20}"/>` +
      ["income", "spend", "saved"].map((k) => `<circle class="cb-dot cb-dot--${k}" cx="${cx(i).toFixed(1)}" cy="${y(m[k]).toFixed(1)}" r="${on ? 5 : 3}"/>`).join("") +
      `<text class="cb-l${on ? " is-on" : ""}" x="${cx(i).toFixed(1)}" y="${H - 26}">${esc(ml(m.key))}</text></g>`;
  }).join("");
  const yrs = per.map((m, i) => [m, i]).filter(([m, i]) => i === 0 || m.key.slice(0, 4) !== per[i - 1].key.slice(0, 4)).map(([m, i]) => {
    const yk = m.key.slice(0, 4), on = year && curKey === yk;
    return `<g data-action="period-pick" data-key="${esc(yk)}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${esc(yk)}">` +
      `<rect class="cb-hit" x="${(cx(i) - step / 2).toFixed(1)}" y="${H - 20}" width="${step * 2}" height="20"/>` +
      `<text class="cb-yr${on ? " is-on" : ""}" x="${(cx(i) - 12).toFixed(1)}" y="${H - 6}">${esc(yk)} ▸</text></g>`;
  }).join("");
  const line = (k) => `<polyline class="cb-line cb-line--${k}" points="${per.map((m, i) => `${cx(i).toFixed(1)},${y(m[k]).toFixed(1)}`).join(" ")}"/>`;
  /* the target steps month by month: what was needed then to finish on time */
  const tgt = tg.length ? `<path class="cb-tgt" d="${tg.map((v, i) => `${i ? "L" : "M"}${(cx(i) - step / 2).toFixed(1)},${y(v).toFixed(1)} L${(cx(i) + step / 2).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>` : "";
  /* names past the last month, sorted by height and pushed 14px apart */
  const li = per.length - 1, ex = (cx(li) + step / 2 + 6).toFixed(1);
  const ends = [["income", "Income", per[li].income], ["spend", "Spent", per[li].spend], ["saved", "Saved", per[li].saved]]
    .concat(tg.length ? [["tgt", "Target", tg[li]]] : []).map(([k, n, v]) => ({ k, n, yy: y(v) + 4 })).sort((p, q) => p.yy - q.yy);
  for (let i = 1; i < ends.length; i++) ends[i].yy = Math.max(ends[i].yy, ends[i - 1].yy + 14);
  const endTxt = ends.map((e) => `<text class="cb-end cb-end--${e.k}" x="${ex}" y="${e.yy.toFixed(1)}">${e.n}</text>`).join("");
  return `<p class="sub">Tap a month or a year.</p>` +
    `<div class="cb-wrap"><svg class="cb-axis" viewBox="0 0 40 ${H}" width="40" height="${H}" aria-hidden="true">${axis}</svg>` +
    `<div class="cb-scroll"><svg class="cb" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="Income, spent and saved by month">${band}${grid}${tgt}${line("income")}${line("spend")}${line("saved")}${groups}${yrs}${endTxt}</svg></div></div>`;
}

export function trendHtml(t, year = false) {
  return `<div class="rank rank--3"><span>${esc(t.name)}</span><span class="trend${t.big ? " trend--big" : ""}">${t.delta > 0 ? "▲ +" : "▼ -"}${formatEur(Math.abs(t.delta))} ${year ? "vs last year" : "vs usual"}</span><b>${formatEur(t.now)}</b></div>`;
}

function trendsHtml(vm) {
  const year = vm.mode === "year";
  const regs = (vm.oneOffs || []).filter((o) => o.amount < 0).map((o) =>
    `<div class="rank rank--3"><span>${esc(o.title)}</span><span class="sub">${esc(o.description || "")}</span><b>${formatEur(-o.amount)}</b></div>`);
  const when = (k) => year ? `${ml(k)} ${k.slice(0, 4)}` : ml(k);
  const exs = vm.exceptional.map((e) => `<div class="rank rank--3"><span>${esc(e.title)}</span><span class="sub">${esc(when(e.start))}${e.end !== e.start ? " to " + esc(when(e.end)) : ""}</span><b>${formatEur(e.amount)}</b></div>`);
  const ex = regs.length + exs.length ? regs.concat(exs).join("") : `<p class="sub">None in ${esc(vm.periodName)}.</p>`;
  const tr = vm.trends.length
    ? vm.trends.map((t) => trendHtml(t, year)).join("")
    : `<p class="sub">${year ? "No year before to compare with." : "Not enough months yet."}</p>`;
  return `<h2>One-off spends</h2><p class="sub">Kept out of the normal ${year ? "years" : "months"}.</p>${ex}` +
    `<h2 class="h-gap">What changed in ${esc(vm.periodName)}</h2><p class="sub">${year ? "Against the same months of the year before." : "Against the average of the three months before."}</p>${tr}`;
}

function catsHtml(vm) {
  if (!vm.cats.length) return "";
  const mx = vm.cats[0].amount;
  return `<h2>Where ${esc(vm.periodName)}'s money went</h2>` + vm.cats.map((c) =>
    `<div class="rank"><span>${esc(c.name)}</span><i><u style="width:${c.amount / mx * 100}%"></u></i><b>${formatEur(c.amount)}</b></div>`).join("");
}

export function overviewHtml(vm, ctx, me = "") {
  return `${chips(vm, ctx, me)}${kpisHtml(vm.kpis, ctx)}${goalHtml(vm.goal)}
    <div class="two"><div class="m3-card m3-card--elevated card"><h2>Spending and saving</h2>${chartHtml(vm)}</div>
    <div class="pane-col"><div class="m3-card m3-card--elevated card pane">${trendsHtml(vm)}</div><div class="m3-card m3-card--elevated card pane">${catsHtml(vm)}</div></div></div>`;
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
export const TITLES = { overview: "Overview", settings: "Settings", roadmap: "Roadmap" };
export function navHtml(tab) {
  return `<button type="button" class="m3-icon-btn" data-action="menu" aria-label="Menu"><span class="m3-icon">menu</span></button>` +
    `<div class="m3-rail__items"><button type="button" class="m3-rail__item${tab === "overview" ? " is-active" : ""}" data-action="tab" data-tab="overview" aria-current="${tab === "overview"}">` +
    `<span class="m3-rail__pill"><span class="m3-icon${tab === "overview" ? " m3-icon--fill" : ""}">savings</span></span><span class="m3-label-m">Overview</span></button></div>`;
}

export function drawerHtml(tab) {
  const item = (t, icon) => `<button type="button" class="m3-drawer__item${t === tab ? " is-active" : ""}" data-action="tab" data-tab="${t}">` +
    `<span class="m3-icon">${icon}</span><span class="m3-drawer__label">${TITLES[t]}</span></button>`;
  return `<div class="m3-drawer__head"><span class="m3-title-l">Kave Stash</span></div>${item("overview", "savings")}${item("settings", "settings")}${item("roadmap", "route")}`;
}

/* The Roadmap page, as Ladle's and Compass's: each tab and what it is for,
   then what is planned, marked Coming soon (spec section 7). */
export function roadmapHtml() {
  const row = (icon, name, text, soon) => `<div class="m3-list-item"><span class="m3-list-item__lead m3-list-item__lead--plain"><span class="m3-icon">${icon}</span></span>` +
    `<div class="m3-list-item__text m3-list-item__text--wrap"><div class="m3-body-l">${name}</div><div class="m3-body-m m3-variant">${text}</div></div>` +
    (soon ? `<span class="m3-chip roadmap-soon">Coming soon</span>` : "") + `</div>`;
  return `<div class="m3-list-header m3-title-s">Tabs</div><div class="m3-grouped">` +
    row("savings", "Overview", "What is left after saving each month, the goal, one-off spends, and where the money went, for each of you and the household.") +
    `</div><div class="m3-list-header m3-title-s">Planned</div><div class="m3-grouped">` +
    row("group", "Household", "The joint account, once its statement is imported.", true) +
    row("trending_up", "One-offs", "Sales and other one-off money, caught by the sweep instead of by hand.", true) + `</div>`;
}

/* Search: the loaded view's categories, months and one-offs, filtered as you
   type, in the kit's full-screen search view (index.html #searchPage). */
export function searchResultsHtml(vm, q = "") {
  const items = vm ? [
    ...vm.cats.map((c) => ({ kind: "Category", name: c.name, value: formatEur(c.amount) })),
    ...vm.periods.map((m) => ({ kind: "Month", name: `${monthName(m.key)} ${m.key.slice(0, 4)}`, value: formatEur(m.spend) })),
    ...(vm.oneOffs || []).map((o) => ({ kind: "One-off", name: o.title, value: formatEur(o.amount) })),
  ] : [];
  const n = q.trim().toLowerCase();
  const hits = n ? items.filter((i) => (i.name + " " + i.kind).toLowerCase().includes(n)) : items;
  const list = hits.length
    ? `<div class="m3-grouped">${hits.map((i) => `<div class="m3-list-item"><div class="m3-list-item__text"><div class="m3-body-l">${esc(i.name)}</div><div class="m3-body-m m3-variant">${i.kind}</div></div><span class="m3-list-item__trail m3-label-l">${i.value}</span></div>`).join("")}</div>`
    : `<div class="empty">${vm ? "Nothing matches." : "Open the Overview first: search looks through what it loaded."}</div>`;
  return list;
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
/* a "YYYY" selection is a year, anything else a month */
export function modeOf(key) { return /^\d{4}$/.test(key || "") ? "year" : "month"; }

/* The view model search looks through: the scope's last good data. */
export function searchVm(env) {
  const g = env.good && env.good.scope === env.scope ? env.good.loaded : (env.loaded && env.loaded.status === "ok" ? env.loaded : null);
  return g ? env.buildView({ summary: g.summary, targets: g.targets, mode: modeOf(env.selected), selected: env.selected }) : null;
}

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
  if (tab === "roadmap") { view.innerHTML = roadmapHtml(); return; }
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
  const draw = (r) => env.buildView({ summary: r.summary, targets: r.targets, mode: modeOf(env.selected), selected: env.selected });
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
