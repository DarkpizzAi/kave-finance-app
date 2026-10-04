/* Stash: load one scope's summary and targets through github.js.

   The summary is JSON (published by publish_summary.py); the targets are a
   markdown table, hand-edited. A missing summary is a state, not an error: it
   is what Isa's scope looks like until step 2 and the household's until the
   joint statement is imported. When BOTH files answer 404 the more likely cause
   is a token that cannot see the repo (GitHub answers 404 for those), so that
   case is "no-access", not "no-summary". The household targets file does not
   exist yet, so for that scope two 404s prove nothing: it stays "no-summary". */
"use strict";

import { parseTargets } from "./targets.js";

export const SCOPES = ["hugo", "isa", "household"];

export function summaryPath(scope) { return `finance/data/summary/${scope}.json`; }
export function targetsPath(scope) {
  return scope === "household" ? "finance/data/household-targets.md" : `${scope}/data/targets.md`;
}

function statusOf(e) {
  switch (e && e.gh) {
    case "unauthorized": return "unauthorized";
    case "offline": return "offline";
    case "rateLimited": return "rate-limited";
    case "notFound": return "no-summary";
    default: return "error";
  }
}

export async function loadScope(gh, scope) {
  const out = { status: "ok", summary: null, targets: null };
  try {
    out.summary = (await gh.getFile(summaryPath(scope))).json;
  } catch (e) {
    out.status = statusOf(e);
    if (out.status !== "no-summary") return out;
  }
  try {
    out.targets = parseTargets((await gh.getText(targetsPath(scope))).text);
  } catch (e) {
    if (!(e && e.gh === "notFound")) { out.status = statusOf(e); out.targets = null; }
    else if (out.status === "no-summary" && scope !== "household") out.status = "no-access";
  }
  return out;
}
