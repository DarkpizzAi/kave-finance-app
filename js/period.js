/* Stash: the chart's periods. Pure: months or years, the selected one, and
   what changed in it. The summary's months are calendar months (YYYY-MM). */
"use strict";

const SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function shortMonth(key) { return SHORT[+key.split("-")[1] - 1]; }
export function monthName(key) { return LONG[+key.split("-")[1] - 1]; }

function add(into, cats) {
  for (const [k, v] of Object.entries(cats || {})) into[k] = (into[k] || 0) + v;
  return into;
}

export function allMonthBuckets(months) {
  return months.map((m) => ({ key: m.label, label: shortMonth(m.label), spend: m.spend,
    saved: m.savedNet, byCategory: m.byCategory || {}, top: m.top || {} }));
}

export function buckets(months, mode, now = new Date()) {
  if (mode === "year") {
    const by = new Map();
    for (const m of months) {
      const y = m.label.slice(0, 4);
      const b = by.get(y) || { key: y, label: y, spend: 0, saved: 0, byCategory: {}, last: m.label, months: [] };
      b.spend += m.spend; b.saved += m.savedNet; add(b.byCategory, m.byCategory); b.last = m.label;
      b.months.push({ mm: m.label.slice(5), byCategory: m.byCategory || {} });
      by.set(y, b);
    }
    const thisYear = String(now.getFullYear());
    return [...by.values()].map((b) => ({ key: b.key, spend: b.spend, saved: b.saved, byCategory: b.byCategory, months: b.months,
      label: b.key === thisYear || !b.last.endsWith("-12") ? `${b.key} so far` : b.key }));
  }
  return allMonthBuckets(months).slice(-6);
}

export function pick(list, key) {
  return list.find((b) => b.key === key) || list[list.length - 1] || null;
}

export function trends(list, key, mode, skip) {
  const i = list.findIndex((b) => b.key === key);
  const need = mode === "year" ? 1 : 3;
  if (i < need) return [];
  const cur = list[i];
  /* a year is compared with the same months of the year before, so a year
     still running is not set against a full one */
  const prev = mode === "year" && cur.months && list[i - 1].months
    ? [{ byCategory: list[i - 1].months.filter((m) => cur.months.some((c) => c.mm === m.mm))
        .reduce((a, m) => add(a, m.byCategory), {}) }]
    : list.slice(i - need, i);
  const names = new Set([...prev.flatMap((b) => Object.keys(b.byCategory)), ...Object.keys(cur.byCategory)]);
  const out = [];
  for (const name of names) {
    if (skip.has(name)) continue;
    const avg = prev.reduce((a, b) => a + (b.byCategory[name] || 0), 0) / prev.length;
    const now = cur.byCategory[name] || 0, delta = now - avg;
    if (Math.abs(delta) >= 30) out.push({ name, now, avg, delta, big: delta > 0 && avg > 0 && delta / avg > 0.5 });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 6);
}
