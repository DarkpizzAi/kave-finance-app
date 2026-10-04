import { test, eq, ok } from "./run.js";
import { overviewHtml, statusHtml, scopesHtml, whoHtml, settingsHtml, staleOverviewHtml } from "../js/render.js";
import { buildView } from "../js/view-model.js";

const NOW = new Date("2026-10-04T10:00:00Z");
const CTX = { scope: "hugo", targetsFile: "hugo/data/targets.md" };
const SUMMARY = {
  generated: "2026-09-28T09:00:00Z", kind: "calendar", savedSoFar: 6000,
  months: [{ label: "2026-08", income: 3000, spend: 2100, savedNet: 900, byCategory: { food: 300 } }],
  oneOffs: [{ slug: "x", title: "<img src=x onerror=alert(1)>", description: "", amount: -50 }],
};
const T = { goal: 30000, deadline: "12/2027", expected: 6000, income: 3000, recurring: 900 };

test("overview shows the safe-to-spend figure and the goal line", () => {
  const html = overviewHtml(buildView({ summary: SUMMARY, targets: T, now: NOW }), CTX);
  ok(html.includes("900 €"), "safe to spend");
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
  const html = overviewHtml(buildView({ summary: { ...SUMMARY, months: [], oneOffs: [] }, targets: T, now: NOW }), CTX);
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
  ok(html.includes("<svg"), "chart drawn");
  ok(!html.includes('height="-'), "negative height");
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
    ok(html.includes("Safe to spend"), s + " overview kept");
  }
  ok(staleOverviewHtml("offline", CTX, vm, "hugo").includes("You are offline"));
});
