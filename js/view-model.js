/* Stash: turn a summary and a targets object into what the Overview draws.
   Pure: no DOM, no storage, no network. Anything that needs a target and does
   not have one becomes null here, and the renderer shows "No target set". */
"use strict";

import { monthsLeft, savingsTarget, leftAfterSaving, goalBar, staleDays, STALE_AFTER_DAYS } from "./calc.js";
import { buckets, allMonthBuckets, pick, trends, monthName } from "./period.js";

export function buildView({ summary, targets, now = new Date(), mode = "month", selected = null }) {
  const t = targets || {};
  const saved = summary ? summary.savedSoFar : null;
  const months = t.goal > 0 && t.deadline ? monthsLeft(t.deadline, now) : null;

  let goal = null, kpis = null;
  if (months != null && saved != null) {
    goal = { goal: t.goal, saved, expected: t.expected || 0, months,
             ...goalBar({ goal: t.goal, saved, expected: t.expected }) };
    if (t.income != null) {
      const savings = savingsTarget({ goal: t.goal, saved, expected: t.expected, months });
      kpis = { left: leftAfterSaving({ income: t.income, savings }),
               income: t.income, savings, expected: t.expected || 0 };
    }
  }

  /* the chart shows every month in both modes; a year is picked by tapping it */
  const periods = summary ? allMonthBuckets(summary.months) : [];
  const years = summary ? buckets(summary.months, "year", now) : [];
  const current = pick(mode === "year" ? years : periods, selected);
  const exAll = summary && summary.exceptional ? summary.exceptional : [];
  const skip = new Set(exAll.map((e) => e.category));
  const key = current ? current.key : null;
  const cut = (v) => (mode === "year" ? v.slice(0, 4) : v);
  const exceptional = key ? exAll.filter((e) => cut(e.start) <= key && key <= cut(e.end)) : [];
  const cats = current
    ? Object.entries(current.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
        .map(([name, amount]) => ({ name, amount }))
    : [];
  /* each month's target is what was still needed when that month began */
  let mtargets = null;
  if (goal && periods.length) {
    let after = 0;
    mtargets = new Array(periods.length);
    for (let i = periods.length - 1; i >= 0; i--) {
      after += periods[i].saved;
      const before = goal.saved - after, left = goal.months + (periods.length - 1 - i);
      mtargets[i] = Math.max(0, Math.round((goal.goal - goal.expected - before) / left));
    }
  }
  const curTarget = mtargets && current && mode === "month"
    ? mtargets[periods.findIndex((p) => p.key === current.key)] : null;
  const age = summary ? staleDays(summary.generated, now) : null;
  const target = kpis ? (mode === "year" ? kpis.savings * 12 : kpis.savings) : null;

  return {
    mtargets, curTarget, goal, kpis, mode, periods, current, selectedKey: selected || null,
    trends: current ? trends(mode === "year" ? years : periods, key, mode, skip) : [],
    exceptional, cats,
    periodName: current ? (mode === "year" ? current.label : monthName(current.key)) : "",
    oneOffs: summary ? summary.oneOffs : [],
    lastDate: summary && summary.lastDate ? summary.lastDate : null,
    kind: summary ? summary.kind : null,
    generated: summary ? summary.generated : null,
    stale: age != null && age > STALE_AFTER_DAYS ? { days: age } : null,
    savingsTarget: target,
  };
}
