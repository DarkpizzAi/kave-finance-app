import { test, eq } from "./run.js";
import { SCOPES, summaryPath, targetsPath, loadScope } from "../js/data.js";

function err(kind) { const e = new Error(kind); e.gh = kind; return e; }
function gh({ summary, text, summaryErr, textErr } = {}) {
  return {
    getFile: async () => { if (summaryErr) throw err(summaryErr); return { json: summary }; },
    getText: async () => { if (textErr) throw err(textErr); return { text }; },
  };
}

test("scopes and paths", () => {
  eq(SCOPES, ["hugo", "isa", "household"]);
  eq(summaryPath("hugo"), "finance/data/summary/hugo.json");
  eq(targetsPath("isa"), "isa/data/targets.md");
  eq(targetsPath("household"), "finance/data/household-targets.md");
});
test("ok loads the summary and parses the targets", async () => {
  const r = await loadScope(gh({ summary: { months: [] }, text: "| Savings goal | 100 | |" }), "hugo");
  eq([r.status, r.targets.goal], ["ok", 100]);
});
test("a missing summary is no-summary but targets are still read", async () => {
  const r = await loadScope(gh({ summaryErr: "notFound", text: "| Savings goal | 100 | |" }), "isa");
  eq([r.status, r.summary, r.targets.goal], ["no-summary", null, 100]);
});
test("both files missing means the token cannot see the repo", async () => {
  const r = await loadScope(gh({ summaryErr: "notFound", textErr: "notFound" }), "hugo");
  eq([r.status, r.summary, r.targets], ["no-access", null, null]);
});
test("household has no targets file yet, so two 404s there stay no-summary", async () => {
  const r = await loadScope(gh({ summaryErr: "notFound", textErr: "notFound" }), "household");
  eq(r.status, "no-summary");
});
test("a missing summary with a failing targets read reports the failure, not no-summary", async () => {
  const r = await loadScope(gh({ summaryErr: "notFound", textErr: "offline" }), "isa");
  eq(r.status, "offline");
});
test("a missing targets file is fine: all targets null", async () => {
  const r = await loadScope(gh({ summary: { months: [] }, textErr: "notFound" }), "hugo");
  eq([r.status, r.targets], ["ok", null]);
});
test("auth, offline and rate limit are reported, not hidden", async () => {
  eq((await loadScope(gh({ summaryErr: "unauthorized" }), "hugo")).status, "unauthorized");
  eq((await loadScope(gh({ summaryErr: "offline" }), "hugo")).status, "offline");
  eq((await loadScope(gh({ summaryErr: "rateLimited" }), "hugo")).status, "rate-limited");
  eq((await loadScope(gh({ summaryErr: "http" }), "hugo")).status, "error");
});
