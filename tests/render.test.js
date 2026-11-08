import { test, eq, ok } from "./run.js";
import { overviewHtml, statusHtml, scopesHtml, whoHtml, settingsHtml, staleOverviewHtml, trendHtml } from "../js/render.js";
import { searchResultsHtml } from "../js/render.js";
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
  for (const l of ["Left after saving / month", "Typical income", "Savings target"]) ok(html.includes(l), l);
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
test("a month with negative spend never draws a negative bar height", () => {
  const neg = { ...SUMMARY, months: [
    { label: "2026-07", income: 3000, spend: -200, savedNet: 0, byCategory: {} },
    { label: "2026-08", income: 3000, spend: 2100, savedNet: 900, byCategory: { food: 300 } }] };
  const html = overviewHtml(buildView({ summary: neg, targets: T, now: NOW }), CTX);
  ok(html.includes('class="cb"'), "chart drawn");
  ok(!html.includes('height="-'), "negative bar height");
  ok(!html.includes('height:-'), "negative height");
  ok(!html.includes("NaN"));
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
  ok(html.includes("Where August's money went"));
});
test("chart: no legend, lines named at their end, selected bar marked", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW, selected: "2026-07" }), CTX);
  ok(html.includes(">Saved</text>")); ok(html.includes("Target"));
  ok(!html.includes("legend")); ok(html.includes('aria-pressed="true"'));
});
test("trend text is signed; a big rise carries the error class", () => {
  ok(trendHtml({ name: "food", now: 450, avg: 200, delta: 250, big: true }).includes("trend--big"));
  ok(trendHtml({ name: "food", now: 100, avg: 200, delta: -100, big: false }).includes("▼ -"));
});
test("Month / Year segmented button", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW, mode: "year" }), CTX);
  ok(html.includes('data-action="period-mode"')); ok(html.includes('data-mode="year" aria-pressed="true"'));
});
test("year view: one-offs carry their year; a lone year names Saved above its point", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW, mode: "year" }), CTX);
  ok(html.includes("Aug 2026"), "year on one-off");
  ok(/cb-end--saved"[^>]*text-anchor="middle"/.test(html), "solo label");
  ok(!overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX).includes("Aug 2026<"), "month view stays short");
});
test("header chip: data up to and imported", () => {
  const s = { ...SUMMARY, lastDate: "2026-08-31" };
  ok(overviewHtml(buildView({ summary: s, targets: T, now: NOW }), CTX).includes("data up to 31 Aug 2026 - imported 28 Sep 2026"));
});
test("one-offs and trends cards: empty states and escaped titles", () => {
  const s = { ...SUMMARY, exceptional: [{ title: "<b>Tax</b>", category: "income-tax", start: "2026-08", end: "2026-08", amount: 300 }] };
  const html = overviewHtml(buildView({ summary: s, targets: T, now: NOW }), CTX);
  ok(html.includes("&lt;b&gt;Tax") && !html.includes("<b>Tax</b>"));
  const none = overviewHtml(buildView({ summary: { ...SUMMARY, exceptional: [] }, targets: T, now: NOW }), CTX);
  ok(none.includes("None in August.")); ok(none.includes("Not enough months yet."));
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
    ok(!html.includes("Sold bike") && !html.includes("None in"), "income one-off skipped, no empty note");
  }
});
test("search rows name months in words", () => {
  const html = searchResultsHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), "");
  ok(html.includes("August 2026") && !/\d{4}-\d{2}/.test(html));
});
