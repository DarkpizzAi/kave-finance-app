import { test, eq } from "./run.js";
import { parseTargets } from "../js/targets.js";

const FULL = `# Example targets

| Item | Value | Notes |
|------|-------|-------|
| Savings goal | 30000 | for December 2027 |
| Deadline | 12/2027 | |
| Expected money | 6000 | a one-off payment |
| Typical income | 3 000 | usual |
| Recurring targets | 900 | |
`;

test("parseTargets reads every row, including a space in a thousand", () => {
  eq(parseTargets(FULL), { goal: 30000, deadline: "12/2027", expected: 6000, income: 3000, recurring: 900 });
});
test("placeholders and blanks are null, never NaN", () => {
  const md = "| Savings goal | [amount] | |\n| Deadline | [MM/YYYY] | |\n| Expected money | | |\n| Typical income | abc | |\n";
  eq(parseTargets(md), { goal: null, deadline: null, expected: null, income: null, recurring: null });
});
test("missing or empty file is all null", () => {
  const none = { goal: null, deadline: null, expected: null, income: null, recurring: null };
  eq([parseTargets(""), parseTargets(null), parseTargets(undefined)], [none, none, none]);
});
test("CRLF files and unknown rows are fine", () => {
  eq(parseTargets("| Savings goal | 5000 | |\r\n| Whatever | 1 | |\r\n").goal, 5000);
});
