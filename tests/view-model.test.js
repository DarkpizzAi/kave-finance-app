import { test, eq, ok } from "./run.js";
import { buildView } from "../js/view-model.js";

const NOW = new Date("2026-10-04T10:00:00Z");
const SUMMARY = {
  generated: "2026-09-28T09:00:00Z", kind: "calendar", savedSoFar: 6000,
  months: [
    { label: "2026-07", income: 3000, spend: 1800, savedNet: 1200, byCategory: { food: 300, housing: 700 } },
    { label: "2026-08", income: 3000, spend: 2100, savedNet: 900, byCategory: { food: 300, housing: 700, travel: 600, refunds: -5 } },
  ],
  oneOffs: [{ slug: "trip", title: "A trip", description: "", amount: -1500 }],
};
const T = { goal: 30000, deadline: "12/2027", expected: 6000, income: 3000 };

test("full targets give the three tiles and the goal bar", () => {
  const v = buildView({ summary: SUMMARY, targets: T, now: NOW });
  eq(Math.round(v.kpis.left), 1800);
  eq(Math.round(v.kpis.savings), 1200);
  eq([v.goal.months, v.goal.saved, v.goal.expected, v.goal.pctTotal], [15, 6000, 6000, 40]);
});
test("categories are the latest month, largest first, positive only", () => {
  const v = buildView({ summary: SUMMARY, targets: T, now: NOW });
  eq(v.cats.map((c) => c.name), ["housing", "travel", "food"]);
  eq([v.current.key, v.periodName], ["2026-08", "August"]);
});
test("no targets means no tiles and no goal, but the spending still shows", () => {
  const v = buildView({ summary: SUMMARY, targets: null, now: NOW });
  eq([v.kpis, v.goal], [null, null]);
  eq(v.periods.length, 2);
});
test("a goal without income gives the bar but not the tiles", () => {
  const v = buildView({ summary: SUMMARY, targets: { ...T, income: null }, now: NOW });
  ok(v.goal); eq(v.kpis, null);
});
test("a summary with no months is an empty chart, not a crash", () => {
  const v = buildView({ summary: { ...SUMMARY, months: [], oneOffs: [] }, targets: T, now: NOW });
  eq([v.periods, v.cats, v.current], [[], [], null]);
});
test("goal already covered gives a zero savings target", () => {
  const v = buildView({ summary: { ...SUMMARY, savedSoFar: 40000 }, targets: T, now: NOW });
  eq([v.kpis.savings, v.goal.pctSaved], [0, 100]);
});
test("a summary older than 45 days is flagged stale", () => {
  const v = buildView({ summary: { ...SUMMARY, generated: "2026-08-01T00:00:00Z" }, targets: T, now: NOW });
  eq(v.stale, { days: 64 });
  eq(buildView({ summary: SUMMARY, targets: T, now: NOW }).stale, null);
});
test("no summary at all is an empty view", () => {
  const v = buildView({ summary: null, targets: T, now: NOW });
  eq([v.goal, v.kpis, v.periods, v.stale], [null, null, [], null]);
});
test("selection drives the cards; default is the last period", () => {
  const v = buildView({ summary: SUMMARY, targets: T, now: NOW, selected: "2026-07" });
  eq([v.current.key, v.periodName], ["2026-07", "July"]);
  eq(buildView({ summary: SUMMARY, targets: T, now: NOW }).current.key, "2026-08");
});
test("year view: target times twelve, so far label", () => {
  const v = buildView({ summary: SUMMARY, targets: T, now: NOW, mode: "year" });
  eq([v.periodName, Math.round(v.savingsTarget)], ["2026 so far", 14400]);
});
test("old summaries without the new fields still render", () => {
  const v = buildView({ summary: SUMMARY, targets: T, now: NOW });
  eq([v.lastDate, v.exceptional], [null, []]);
});
test("exceptional spends follow the selected period", () => {
  const s = { ...SUMMARY, exceptional: [{ title: "Tax", category: "income-tax", start: "2026-07", end: "2026-07", amount: 300 }] };
  eq(buildView({ summary: s, targets: T, now: NOW, selected: "2026-07" }).exceptional.length, 1);
  eq(buildView({ summary: s, targets: T, now: NOW }).exceptional.length, 0);
});
