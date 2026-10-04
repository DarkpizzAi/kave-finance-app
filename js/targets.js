/* Stash: read a targets file (a markdown table, hand-edited in kave-hub).

   Only these first-column labels are read, so a person can add notes or rows
   without breaking the app. A value that is blank, bracketed ([amount]) or not
   a number is null: "no target set", never NaN. */
"use strict";

const RULES = [
  ["goal", /^savings goal$/i],
  ["deadline", /^deadline$/i],
  ["expected", /^expected money$/i],
  ["income", /^typical income$/i],
  ["recurring", /^recurring targets$/i],
];

export function parseTargets(md) {
  const out = { goal: null, deadline: null, expected: null, income: null, recurring: null };
  for (const line of String(md == null ? "" : md).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith("|")) continue;
    const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells.length < 2) continue;
    for (const [key, re] of RULES) {
      if (!re.test(cells[0])) continue;
      if (key === "deadline") {
        out.deadline = /^\d{1,2}\/\d{4}$/.test(cells[1]) ? cells[1] : null;
      } else {
        const n = Number(cells[1].replace(/[\s  ]/g, ""));
        out[key] = cells[1] !== "" && Number.isFinite(n) ? n : null;
      }
    }
  }
  return out;
}
