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

/* display names and Material Symbols for ledger categories (spec section 5) */
const LABEL = { "tail-spend": "Small buys" };
const ICON = { housing: "home", food: "restaurant", leisure: "local_activity", travel: "flight", transport: "directions_bus",
  subscriptions: "autorenew", health: "favorite", services: "build", "tail-spend": "shopping_bag", bizum: "swap_horiz" };
/* a rise is error red, a fall is green */
const trendSpan = (t, extra = "") => !t.delta ? "<span></span>" : `<span class="trend ${t.delta > 0 ? "trend--up" : "trend--down"}">${t.delta > 0 ? "▲ +" : "▼ -"}${formatEur(Math.abs(t.delta))}${extra}</span>`;

export function trendHtml(t, year = false) {
  return `<div class="rank rank--3"><span>${esc(LABEL[t.name] || t.name)}</span>${trendSpan(t, year ? " vs last year" : " vs usual")}<b>${formatEur(t.now)}</b></div>`;
}

function topHtml(items, year) {
  if (year) return `<p class="sub">Pick a month to see its biggest spends.</p>`;
  if (!items.length) return `<p class="sub">No single spends to show.</p>`;
  return items.slice(0, 5).map((it) => {
    const d = String(it.date || "");
    return `<div class="ctop__r"><span class="ctop__d">${esc(d.slice(8, 10))}/${esc(d.slice(5, 7))}</span><span>${esc(it.name)}</span><b>${formatEur(it.amount)}</b></div>`;
  }).join("");
}

/* The selected month or year: stats, where it went (tap a row for its top 5),
   and the one-offs kept out of the figures. */
function periodHtml(vm, openCat) {
  const c = vm.current; if (!c) return "";
  const year = vm.mode === "year";
  /* a year's target is the sum of its months' targets */
  const tgt = year
    ? (vm.mtargets && vm.mtargets.length ? vm.periods.reduce((a, p, i) => a + (p.key.startsWith(c.key + "-") ? (vm.mtargets[i] || 0) : 0), 0) : null)
    : vm.curTarget;
  const diff = tgt != null ? c.saved - tgt : null;
  const name = year ? c.label : `${monthName(c.key)} ${c.key.slice(0, 4)}`;
  const stat = (l, v, cls = "") => `<div class="pstat${cls}"><small>${l}</small><b>${v}</b></div>`;
  const when = (k) => year ? `${ml(k)} ${k.slice(0, 4)}` : ml(k);
  const regs = (vm.oneOffs || []).filter((o) => o.amount < 0).map((o) =>
    `<div class="rank rank--3"><span>${esc(o.title)}</span><span class="sub">${esc(o.description || "")}</span><b>${formatEur(-o.amount)}</b></div>`);
  const exs = vm.exceptional.map((e) => `<div class="rank rank--3"><span>${esc(e.title)}</span><span class="sub">${esc(when(e.start))}${e.end !== e.start ? " to " + esc(when(e.end)) : ""}</span><b>${formatEur(e.amount)}</b></div>`);
  const tmap = vm.tmap || new Map((vm.trends || []).map((t) => [t.name, t]));
  const sum = vm.cats.reduce((a, q) => a + q.amount, 0), top = vm.cats.length ? vm.cats[0].amount : 0;
  const cats = vm.cats.map((x) => {
    const t = tmap.get(x.name), pct = sum ? Math.round(x.amount / sum * 100) : 0;
    const open = openCat === x.name;
    const list = open ? `<div class="ctop">${topHtml(((c.top || {})[x.name]) || [], year)}</div>` : "";
    return `<div class="crow${open ? " is-open" : ""}" data-action="cat-pick" data-cat="${esc(x.name)}" role="button" tabindex="0" aria-expanded="${open}">` +
      `<span class="crow__n"><span class="m3-icon crow__i" aria-hidden="true">${ICON[x.name] || "category"}</span>${esc(LABEL[x.name] || x.name)}</span>` +
      `<span class="crow__p">${pct}%</span>${t ? trendSpan(t) : "<span></span>"}<b>${formatEur(x.amount)}</b>` +
      `<i><u style="width:${top ? x.amount / top * 100 : 0}%"></u></i></div>${list}`;
  }).join("");
  return `<div class="m3-card m3-card--elevated card"><h2>${esc(name)}</h2>
    <div class="pstats">${stat("Income", formatEur(c.income))}${stat("Spent", formatEur(c.spend))}${stat("Saved", formatEur(c.saved), " pstat--saved")}` +
    (diff != null ? stat(`vs target ${formatEur(tgt)}`, `${diff >= 0 ? "+" : "-"}${formatEur(Math.abs(diff))}`) : "") + `</div>
    <h3 class="m3-title-s h-gap">Where it went</h3><p class="sub">${year
      ? "Share of the year, and the change against the same months of the year before."
      : "Share of the month (tap one for its top 5), and the change against the three months before."}</p>${cats || `<p class="sub">Nothing spent.</p>`}
    ${regs.length + exs.length ? `<h3 class="m3-title-s h-gap">One-off spends</h3><p class="sub">Kept out of the figures above.</p>${regs.concat(exs).join("")}` : ""}</div>`;
}

/* The plan: the pace line (when the view model has one), the goal bar, then
   what is left after saving, typical income and what is needed from now. */
function planHtml(vm, ctx) {
  const k = vm.kpis, g = vm.goal, p = vm.pace;
  const paceLine = p && g ? `At your pace (${formatEur(Math.round(p.avg))} a month) you reach ${formatEur(g.goal)} in <b>${esc(monthName(`${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, "0")}`))} ${p.date.getFullYear()}</b>` +
    (p.early > 0 ? `, ${p.early} month${p.early === 1 ? "" : "s"} early.` : p.early < 0 ? `, ${-p.early} month${p.early === -1 ? "" : "s"} late.` : ", right on time.") : "";
  return `<div class="m3-card m3-card--elevated card"><h2>Your plan</h2>${paceLine ? `<p class="pace">${paceLine}</p>` : ""}
    ${g ? `<div class="track"><div class="seg-saved" style="width:${g.pctSaved}%"></div><div class="seg-pend" style="width:${g.pctExpected}%"></div></div>
    <p class="sub">${formatEur(g.saved)} saved + ${formatEur(g.expected)} on its way = ${formatEur(g.total)} of ${formatEur(g.goal)} (${g.pctTotal}%), ${g.months} months to go</p>` : ""}
    ${k ? `<div class="pstats h-gap"><div class="pstat pstat--hero"><small>Left after saving / month</small><b>${formatEur(k.left)}</b></div><div class="pstat"><small>Typical income</small><b>${formatEur(k.income)}</b></div><div class="pstat"><small>Needed from now</small><b>${formatEur(k.savings)} / month</b></div></div>`
      : `<p class="sub">No target set: add it in ${esc(ctx.targetsFile)}.</p>`}</div>`;
}

export function overviewHtml(vm, ctx, me = "", openCat = null) {
  return `${chips(vm, ctx, me)}<div class="m3-card m3-card--elevated card"><h2>Spending and saving</h2>${chartHtml(vm)}</div>
    <div class="two">${periodHtml(vm, openCat)}${planHtml(vm, ctx)}</div>`;
}

/* Pure overview, with the status of a failed refresh on top. Used when the
   last good result for this scope is still on screen. */
export function staleOverviewHtml(status, ctx, vm, me = "", openCat = null) {
  return statusHtml(status, ctx) + `<p class="sub">Showing the last data that loaded.</p>` + overviewHtml(vm, ctx, me, openCat);
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
    view.innerHTML = good ? overviewHtml(draw(good), ctx, me, env.openCat) : `<div class="note">Loading...</div>`;
    return;
  }
  if (loaded.status !== "ok") {
    view.innerHTML = good && TRANSIENT.includes(loaded.status)
      ? staleOverviewHtml(loaded.status, ctx, draw(good), me, env.openCat)
      : statusHtml(loaded.status, ctx);
    return;
  }
  view.innerHTML = overviewHtml(draw(loaded), ctx, me, env.openCat);
}
