/* Stash: turn a summary and a targets object into what the Overview draws.
   Pure: no DOM, no storage, no network. Anything that needs a target and does
   not have one becomes null here, and the renderer shows "No target set". */
"use strict";

import { monthsLeft, savingsTarget, safeToSpend, goalBar, staleDays, STALE_AFTER_DAYS } from "./calc.js";

export function buildView({ summary, targets, now = new Date() }) {
  const t = targets || {};
  const saved = summary ? summary.savedSoFar : null;
  const months = t.goal > 0 && t.deadline ? monthsLeft(t.deadline, now) : null;

  let goal = null, kpis = null;
  if (months != null && saved != null) {
    goal = { goal: t.goal, saved, expected: t.expected || 0, months,
             ...goalBar({ goal: t.goal, saved, expected: t.expected }) };
    if (t.income != null && t.recurring != null) {
      const savings = savingsTarget({ goal: t.goal, saved, expected: t.expected, months });
      kpis = { safe: safeToSpend({ income: t.income, savings, recurring: t.recurring }),
               income: t.income, savings, recurring: t.recurring, expected: t.expected || 0 };
    }
  }

  const recent = summary ? summary.months.slice(-6) : [];
  const last = recent[recent.length - 1];
  const cats = last
    ? Object.entries(last.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount }))
    : [];
  const age = summary ? staleDays(summary.generated, now) : null;

  return {
    goal, kpis,
    months: recent.map((m) => ({ label: m.label, spend: m.spend })),
    lastLabel: last ? last.label : null,
    cats,
    oneOffs: summary ? summary.oneOffs : [],
    kind: summary ? summary.kind : null,
    generated: summary ? summary.generated : null,
    stale: age != null && age > STALE_AFTER_DAYS ? { days: age } : null,
  };
}
