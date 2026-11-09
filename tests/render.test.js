import { test, eq, ok } from "./run.js";
import { overviewHtml, statusHtml, scopesHtml, whoHtml, settingsHtml, staleOverviewHtml, trendHtml } from "../js/render.js";
import { searchResultsHtml, modeOf } from "../js/render.js";
import { buildView } from "../js/view-model.js";

const NOW = new Date("2026-10-04T10:00:00Z");
const CTX = { scope: "hugo", targetsFile: "hugo/data/targets.md" };
const SUMMARY = {
  generated: "2026-09-28T09:00:00Z", kind: "calendar", savedSoFar: 6000,
  months: [
    { label: "2026-07", income: 3000, spend: 1800, savedNet: 1200, byCategory: { food: 300 } },
    { label: "2026-08", income: 3000, spend: 2100, savedNet: 900, byCategory: { food: 300 } }],
  oneOffs: [],
  exceptional: [{ title: "<img src=x onerror=alert(1)>", category: "flat", start: "2026-08", end: "2026-08", amount: 50 }],
};
const T = { goal: 30000, deadline: "12/2027", expected: 6000, income: 3000 };

test("overview shows the three tiles and the goal line", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  for (const l of ["Left after saving / month", "Typical income", "Needed from now"]) ok(html.includes(l), l);
  ok(!html.includes("Safe to spend") && !html.includes("Recurring"), "old tiles gone");
  ok(html.includes("1 800 €"), "left after saving");
  ok(html.includes("6 000 € saved + 6 000 € on its way"), "goal line");
  ok(html.includes("15 months to go"), "months");
});
test("no targets says No target set and names the file, never NaN", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: null, now: NOW }), CTX);
  ok(html.includes("No target set")); ok(html.includes("hugo/data/targets.md"));
  ok(!html.includes("NaN"));
});
test("a synced string is escaped, not interpreted", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  ok(!html.includes("<img"), "raw tag leaked");
  ok(html.includes("&lt;img"), "escaped tag expected");
});
test("an empty summary draws an empty note, not a chart", () => {
  const html = overviewHtml(buildView({ summary: { ...SUMMARY, months: [], oneOffs: [], exceptional: [] }, targets: T, now: NOW }), CTX);
  ok(html.includes("No months yet")); ok(!html.includes("<svg"));
});
test("a stale summary says how old it is", () => {
  const html = overviewHtml(buildView({ summary: { ...SUMMARY, generated: "2026-08-01T00:00:00Z" }, targets: T, now: NOW }), CTX);
  ok(html.includes("64 days old"));
});
test("the month kind is named in the header chips", () => {
  ok(overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX).includes("calendar months"));
});
test("every status has a plain message", () => {
  for (const s of ["no-token", "unauthorized", "offline", "rate-limited", "error"]) {
    ok(statusHtml(s, CTX).length > 20, s);
  }
  ok(statusHtml("no-summary", CTX).includes("No summary published yet"));
  ok(statusHtml("no-access", CTX).includes("cannot see the household repo"));
  ok(statusHtml("no-access", CTX).includes("Settings"));
  ok(statusHtml("no-token", CTX).includes("Settings"));
});
test("the switcher names people, marks the viewer, and flags another person's view", () => {
  const html = scopesHtml("isa", "hugo");
  ok(html.includes("Hugo (you)")); ok(html.includes("Isa")); ok(html.includes("Household"));
  ok(html.includes('aria-selected="true"'));
});
test("first launch asks who is looking", () => {
  const html = whoHtml();
  ok(html.includes('data-action="who"') && html.includes('data-who="hugo"') && html.includes('data-who="isa"'));
});
test("Settings warns loudly when the theme preload did not run", () => {
  const s = { token: "", me: "hugo" };
  ok(settingsHtml(s, false).includes("Theme preload BLOCKED: recompute the CSP hash (see README)."));
  ok(!settingsHtml(s, true).includes("Theme preload BLOCKED"));
  ok(!settingsHtml(s).includes("Theme preload BLOCKED"), "default is no warning");
});
test("Settings keeps an unsaved token draft instead of the saved one", () => {
  const html = settingsHtml({ token: "saved", me: "" }, true, "typed<x>");
  ok(html.includes('value="typed&lt;x&gt;"'), "draft shown, escaped");
  ok(!html.includes('value="saved"'));
});
test("a transient failure keeps the last good overview under a note", () => {
  const vm = buildView({ summary: SUMMARY, targets: T, now: NOW });
  for (const s of ["offline", "rate-limited", "error"]) {
    const html = staleOverviewHtml(s, CTX, vm, "hugo");
    ok(html.startsWith('<div class="note"'), s + " note first");
    ok(html.includes("last data that loaded"), s + " says it is old");
    ok(html.includes("Left after saving"), s + " overview kept");
  }
  ok(staleOverviewHtml("offline", CTX, vm, "hugo").includes("You are offline"));
});
test("plain titles: no YYYY-MM anywhere a person reads", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  ok(!/\d{4}-\d{2}/.test(html.replace(/data-key="[^"]*"/g, "")), "no raw month keys in text");
  ok(html.includes("August 2026") && html.includes("Where it went"));
});
test("chart: no legend, lines named at their end, selected month marked", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW, selected: "2026-07" }), CTX);
  ok(html.includes(">Saved</text>")); ok(html.includes("Target"));
  ok(!html.includes("legend")); ok(html.includes('aria-pressed="true"'));
});
test("trend text is signed; a rise carries the up (error) class", () => {
  ok(trendHtml({ name: "food", now: 450, avg: 200, delta: 250, big: true }).includes("trend--up"));
  ok(trendHtml({ name: "food", now: 100, avg: 200, delta: -100, big: false }).includes("▼ -"));
  ok(trendHtml({ name: "food", now: 100, avg: 200, delta: -100, big: false }, true).includes("vs last year"));
});
test("one-offs and trends cards: empty states and escaped titles", () => {
  const s = { ...SUMMARY, exceptional: [{ title: "<b>Tax</b>", category: "income-tax", start: "2026-08", end: "2026-08", amount: 300 }] };
  const html = overviewHtml(buildView({ summary: s, targets: T, now: NOW }), CTX);
  ok(html.includes("&lt;b&gt;Tax") && !html.includes("<b>Tax</b>"));
  const none = overviewHtml(buildView({ summary: { ...SUMMARY, exceptional: [] }, targets: T, now: NOW }), CTX);
  ok(!none.includes("One-off spends"), "no empty one-offs heading");
  ok(!none.includes("NaN"));
});
test("registered one-offs show as spends in every period, escaped", () => {
  const s = { ...SUMMARY, exceptional: [], oneOffs: [
    { slug: "trip", title: "<i>Trip</i>", description: "Flights & hotel", amount: -1500 },
    { slug: "sale", title: "Sold bike", description: "", amount: 200 }] };
  for (const sel of [null, "2026-07"]) {
    const html = overviewHtml(buildView({ summary: s, targets: T, now: NOW, selected: sel }), CTX);
    ok(html.includes("&lt;i&gt;Trip") && !html.includes("<i>Trip"), "escaped title");
    ok(html.includes("1 500 €") && html.includes("Flights &amp; hotel"), "amount and description");
    ok(!html.includes("Sold bike"), "income one-off skipped");
  }
});
test("search rows name months in words", () => {
  const html = searchResultsHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), "");
  ok(html.includes("August 2026") && !/\d{4}-\d{2}/.test(html));
});

test("chart draws income, spent and saved as lines", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  for (const k of ["income", "spend", "saved"]) ok(new RegExp(`<polyline class="cb-line cb-line--${k}"`).test(html), k);
  ok(!html.includes("cb-bar"), "no bars");
  ok(!html.includes("NaN"));
});
test("line ends are named and never closer than 14px", () => {
  const s = { ...SUMMARY, months: [
    { label: "2026-07", income: 3000, spend: 1800, savedNet: 1200, byCategory: {} },
    { label: "2026-08", income: 1000, spend: 990, savedNet: 10, byCategory: {} }] };
  const vm = buildView({ summary: s, targets: T, now: NOW });
  vm.mtargets = [1500, 12];
  const html = overviewHtml(vm, CTX);
  const ys = ["income", "spend", "saved", "tgt"].map((k) => +html.match(new RegExp(`cb-end--${k}" x="[^"]*" y="([^"]*)"`))[1]);
  for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) ok(Math.abs(ys[i] - ys[j]) >= 14 - 1e-9, `${i}/${j}`);
});
test("the target steps month by month", () => {
  const vm = buildView({ summary: SUMMARY, targets: T, now: NOW });
  ok(vm.mtargets && vm.mtargets.length === vm.periods.length, "targets aligned");
  const d = overviewHtml(vm, CTX).match(/<path class="cb-tgt" d="([^"]*)"/)[1];
  eq((d.match(/[ML]/g) || []).length, 2 * vm.periods.length);
});
test("chart sub-line is short", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  ok(html.includes("Tap a month or a year.")); ok(!html.includes("Bars:"));
  ok(!html.includes('data-action="period-mode"'), "no Month / Year chips");
});
test("no imported chip", () => {
  const s = { ...SUMMARY, lastDate: "2026-08-31" };
  ok(!overviewHtml(buildView({ summary: s, targets: T, now: NOW }), CTX).includes("imported"));
  const late = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: new Date("2026-12-20T10:00:00Z") }), CTX);
  ok(late.includes("days old"), "stale chip stays");
});
test("year label selects the year, months of that year are banded", () => {
  const s = { ...SUMMARY, months: [
    { label: "2025-12", income: 3000, spend: 1800, savedNet: 1200, byCategory: {} }, ...SUMMARY.months] };
  const html = overviewHtml(buildView({ summary: s, targets: T, now: NOW, mode: modeOf("2026"), selected: "2026" }), CTX);
  ok(/data-action="period-pick" data-key="2026" [^>]*aria-pressed="true"/.test(html), "year label pressed");
  ok(html.includes('data-key="2025"'), "first year label");
  ok(html.includes('data-key="2026-07"'), "months keep month keys");
  eq((html.match(/class="cb-band"/g) || []).length, 2, "both 2026 months banded");
  eq(modeOf("2026-07"), "month");
});

/* v0.11 period card, drill-down and plan card */
const TOPS = [["2026-08-03", "Bistro <one>", 60], ["2026-08-09", "Market", 50], ["2026-08-14", "Cafe", 40], ["2026-08-20", "Bakery", 30], ["2026-08-27", "Deli", 20]]
  .map(([date, name, amount]) => ({ date, name, amount }));
const TOPSUM = { ...SUMMARY, exceptional: [], months: [SUMMARY.months[0], { ...SUMMARY.months[1], byCategory: { food: 300, "tail-spend": 80 }, top: { food: TOPS } }] };
test("a fall is green with a down triangle", () => {
  const down = trendHtml({ name: "food", now: 150, avg: 200, delta: -50, big: false });
  ok(down.includes('class="trend trend--down"') && down.includes("▼ -50"), down);
  const up = trendHtml({ name: "food", now: 250, avg: 200, delta: 50, big: false });
  ok(up.includes("trend--up") && up.includes("▲ +"));
});
test("tapping a category lists its top five", () => {
  const html = overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW }), CTX, "", "food");
  eq((html.match(/class="ctop__r"/g) || []).length, 5);
  ok(html.includes(">03/08<") && html.includes(">27/08<"), "dd/mm dates");
  ok(html.includes("Bistro &lt;one&gt;") && !html.includes("<one>"), "names escaped");
  ok(/<button type="button" class="m3-list-item m3-list-item--tap crow is-open" data-action="cat-pick" data-cat="food" aria-expanded="true">/.test(html), "row expanded");
  ok(html.includes("expand_less") && html.includes("expand_more"), "expand indicators");
  ok(!overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW }), CTX).includes("ctop"), "closed by default");
});
test("an opened category with no top data says so", () => {
  const html = overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW }), CTX, "", "tail-spend");
  ok(html.includes("No single spends to show."));
});
test("year view asks for a month", () => {
  const html = overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW, mode: "year", selected: "2026" }), CTX, "", "food");
  ok(html.includes("Pick a month to see its biggest spends.")); ok(!html.includes("ctop__r"));
});
test("tail-spend shows as Small buys with its icon", () => {
  const html = overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW }), CTX);
  ok(html.includes("Small buys") && html.includes("shopping_bag") && html.includes("restaurant"));
  ok(!/>tail-spend</.test(html) && !html.replace(/data-cat="[^"]*"/g, "").includes("tail-spend"), "raw name hidden");
});
test("saved stat is green, target is the month's", () => {
  const vm = buildView({ summary: TOPSUM, targets: T, now: NOW });
  vm.curTarget = 773;
  const html = overviewHtml(vm, CTX);
  const period = html.slice(html.indexOf('<div class="two">'), html.indexOf("Your plan"));
  ok(period.includes("pstat--saved"), "saved stat"); ok(!period.includes("pstat--hero"), "no hero in period card");
  ok(html.includes("vs target 773"), "month target");
});
test("plan card says Needed from now", () => {
  const html = overviewHtml(buildView({ summary: TOPSUM, targets: T, now: NOW }), CTX);
  ok(html.includes("Needed from now")); ok(!html.includes("Savings target"));
});

test("a zero change shows no trend", () => {
  const html = trendHtml({ name: "food", now: 200, avg: 200, delta: 0, big: false });
  ok(!html.includes("trend--") && !html.includes("-0") && html.includes("<span></span>"), html);
});
test("pace reaches the goal early at a good saving rate", () => {
  const s = { ...SUMMARY, savedSoFar: 10000, months: [
    { label: "2026-07", income: 3000, spend: 1000, savedNet: 2000, byCategory: {} },
    { label: "2026-08", income: 3000, spend: 1000, savedNet: 2000, byCategory: {} }] };
  const vm = buildView({ summary: s, targets: { goal: 30000, deadline: "12/2027", expected: 4000, income: 3000 }, now: NOW });
  eq(vm.pace.avg, 2000); eq(vm.pace.n, 8); eq(vm.pace.early, vm.goal.months - 8);
  ok(vm.pace.early > 0, "early");
  eq(vm.pace.date.getMonth(), 5); eq(vm.pace.date.getFullYear(), 2027);
  const html = overviewHtml(vm, CTX);
  ok(html.includes("At your pace (2 000 € a month) you reach 30 000 € in <b>June 2027</b>, " + vm.pace.early + " months early."), "pace line");
});
test("no goal, no pace", () => {
  eq(buildView({ summary: SUMMARY, targets: null, now: NOW }).pace, null);
  ok(!overviewHtml(buildView({ summary: SUMMARY, targets: null, now: NOW }), CTX).includes("At your pace"));
});

test("year buckets add up income", () => {
  const vm = buildView({ summary: SUMMARY, targets: T, now: NOW, mode: "year", selected: "2026" });
  eq(vm.current.income, 6000);
  ok(!overviewHtml(vm, CTX).includes("NaN"), "no NaN");
});
