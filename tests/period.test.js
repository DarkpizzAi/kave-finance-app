import { test, eq, ok } from "./run.js";
import { buckets, allMonthBuckets, pick, trends, monthName } from "../js/period.js";

const M = (label, spend, saved, cats) => ({ label, income: spend + saved, spend, savedNet: saved, byCategory: cats });
const MONTHS = [
  M("2025-11", 1000, 500, { food: 400 }), M("2025-12", 1000, 500, { food: 400 }),
  M("2026-01", 1000, 500, { food: 300 }), M("2026-02", 1000, 500, { food: 300 }),
  M("2026-03", 1000, 500, { food: 300 }), M("2026-04", 1000, 500, { food: 300, travel: 100 }),
  M("2026-05", 1200, 300, { food: 450, travel: 0 }),
];
const NOW = new Date("2026-06-10T10:00:00Z");

test("month buckets are the last six, labelled by short month", () => {
  const b = buckets(MONTHS, "month", NOW);
  eq(b.map((x) => x.label), ["Dec", "Jan", "Feb", "Mar", "Apr", "May"]);
  eq(b[5].saved, 300);
});
test("year buckets sum each year; the running year says so far", () => {
  const b = buckets(MONTHS, "year", NOW);
  eq(b.map((x) => [x.label, x.spend, x.saved]), [["2025", 2000, 1000], ["2026 so far", 5200, 2300]]);
  eq(b[1].byCategory.food, 1650);
});
test("pick returns the selected bucket, else the last", () => {
  const b = buckets(MONTHS, "month", NOW);
  eq(pick(b, "2026-02").label, "Feb");
  eq(pick(b, "nope").label, "May");
  eq(pick([], null), null);
});
test("month trends compare with the three months before; big rises flagged", () => {
  const t = trends(buckets(MONTHS, "month", NOW), "2026-05", "month", new Set());
  // travel fell from a mean of 33.3 to 0 (delta -33), which is past the 30 cut
  eq(t.map((x) => [x.name, Math.round(x.delta), x.big]), [["food", 150, false], ["travel", -33, false]]);
});
test("a rise over half of usual is big", () => {
  const ms = MONTHS.slice(0, 6).concat(M("2026-05", 1000, 500, { food: 500 }));
  eq(trends(buckets(ms, "month", NOW), "2026-05", "month", new Set())[0].big, true);
});
test("skipped categories and small moves are left out", () => {
  // food is skipped; travel's fall of 33 is still past the 30 cut
  eq(trends(buckets(MONTHS, "month", NOW), "2026-05", "month", new Set(["food"])).map((x) => x.name), ["travel"]);
  eq(trends(buckets(MONTHS, "month", NOW), "2026-05", "month", new Set(["food", "travel"])), []);
  const small = MONTHS.slice(0, 6).concat(M("2026-05", 1000, 500, { food: 310, travel: 40 }));
  eq(trends(buckets(small, "month", NOW), "2026-05", "month", new Set()), []);
});
test("not enough history gives no trends", () => {
  eq(trends(buckets(MONTHS.slice(0, 2), "month", NOW), "2025-12", "month", new Set()), []);
  eq(trends(buckets(MONTHS.slice(2), "year", NOW), "2026", "year", new Set()), []);
});
test("year trends compare with the year before", () => {
  const t = trends(buckets(MONTHS, "year", NOW), "2026", "year", new Set());
  eq(t[0].name, "food");
});
test("trends use all months, not only the six shown", () => {
  const t = trends(allMonthBuckets(MONTHS), "2026-02", "month", new Set());
  eq(t.map((x) => x.name), ["food"]);   // Nov-Jan average 366.7 vs 300
});
test("month names", () => { eq(monthName("2026-08"), "August"); });
