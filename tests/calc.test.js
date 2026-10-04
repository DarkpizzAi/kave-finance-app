import { test, eq, ok } from "./run.js";
import { monthsLeft, savingsTarget, safeToSpend, goalBar, staleDays, STALE_AFTER_DAYS, formatEur } from "../js/calc.js";

const NOW = new Date("2026-10-04T10:00:00Z");

test("monthsLeft counts this month through the deadline month", () => {
  eq(monthsLeft("12/2027", NOW), 15);
});
test("monthsLeft is at least 1 for this month or the past", () => {
  eq([monthsLeft("10/2026", NOW), monthsLeft("01/2026", NOW)], [1, 1]);
});
test("monthsLeft is null for text that is not a deadline", () => {
  eq([monthsLeft("", NOW), monthsLeft("[MM/YYYY]", NOW), monthsLeft(null, NOW)], [null, null, null]);
});
test("savingsTarget spreads what is left over the months", () => {
  eq(savingsTarget({ goal: 30000, saved: 6000, expected: 6000, months: 15 }), 1200);
});
test("savingsTarget is 0 once the goal is covered", () => {
  eq(savingsTarget({ goal: 1000, saved: 900, expected: 500, months: 3 }), 0);
});
test("safeToSpend is income minus savings minus recurring", () => {
  eq(safeToSpend({ income: 3000, savings: 1200, recurring: 900 }), 900);
});
test("goalBar caps at 100 percent and never overflows", () => {
  const b = goalBar({ goal: 1000, saved: 900, expected: 500 });
  eq([b.pctSaved, b.pctExpected, b.total, b.pctTotal], [90, 10, 1400, 140]);
});
test("staleDays counts whole days and rejects junk", () => {
  eq(staleDays("2026-09-20T09:00:00Z", NOW), 14);
  eq(staleDays("nonsense", NOW), null);
  eq(STALE_AFTER_DAYS, 45);
});
test("formatEur uses a plain space for thousands and the euro after", () => {
  eq([formatEur(1250), formatEur(30000), formatEur(-200), formatEur(0)], ["1 250 €", "30 000 €", "-200 €", "0 €"]);
});
