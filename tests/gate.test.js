import { test, eq, ok } from "./run.js";
import { gateStep, gateHtml, setFresh } from "../js/gate.js";

test("without a token only the gate shows; the token unlocks, then who, then the theme once", () => {
  setFresh(false);
  eq(gateStep({ token: "", me: "" }), "token");
  eq(gateStep({ token: "", me: "isa" }), "token", "a remembered person does not skip the token");
  eq(gateStep({ token: "t", me: "" }), "who");
  eq(gateStep({ token: "t", me: "isa" }), null, "unlocked");
  setFresh(true);
  eq(gateStep({ token: "t", me: "isa" }), "theme", "a fresh token asks the theme once");
  setFresh(false);
});

test("the gate is the kit's basic dialog with a labelled field and the accent button, no intro text", () => {
  const h = gateHtml("token");
  ok(h.includes("m3-dialog m3-dialog--basic"));
  ok(h.includes('class="m3-field__label">Access<'));
  ok(h.includes("m3-btn--filled"));
  ok(!/<p[ >]/.test(h), "no paragraph of intro text");
  ok(gateHtml("who").includes('data-gate-who="isa"') && gateHtml("theme").includes('data-gate-palette="chartreuse"'));
});
