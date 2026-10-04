/* Stash: the targets maths. Pure functions, no DOM, no storage.

   The savings target is COMPUTED from the goal, never typed:
   (goal - saved - expected) / months left. "Saved" comes from the ledger
   summary, "expected" from the targets file (money known to be coming back,
   counted in the plan and removed from the file when it lands). */
"use strict";

export const STALE_AFTER_DAYS = 45;

/* Months from the current month through the deadline month (MM/YYYY),
   at least 1. null when the text is not a deadline. */
export function monthsLeft(deadline, now = new Date()) {
  const m = String(deadline == null ? "" : deadline).match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const n = (+m[2] - now.getFullYear()) * 12 + (+m[1] - now.getMonth() - 1) + 1;
  return Math.max(n, 1);
}

export function savingsTarget({ goal, saved, expected, months }) {
  return Math.max((goal - saved - (expected || 0)) / months, 0);
}

export function safeToSpend({ income, savings, recurring }) {
  return income - savings - recurring;
}

/* Solid segment = saved, striped segment = expected. Both are capped so the
   two together never pass 100 percent of the bar. */
export function goalBar({ goal, saved, expected }) {
  const exp = expected || 0;
  const pctSaved = Math.min(saved / goal * 100, 100);
  const pctExpected = Math.max(Math.min(exp / goal * 100, 100 - pctSaved), 0);
  return { pctSaved, pctExpected, total: saved + exp, pctTotal: Math.round((saved + exp) / goal * 100) };
}

export function staleDays(iso, now = new Date()) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86400000);
}

export function formatEur(n) {
  return Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ") + " €";
}
