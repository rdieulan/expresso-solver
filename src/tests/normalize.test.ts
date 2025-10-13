import assert from "assert";
import { normalizeHandLabel } from "../domain";

const cases: Array<[string, string]> = [
  ["AhKs", "AKO"],
  ["AsKs", "AKS"],
  ["AKs", "AKS"],
  ["AK", "AKO"],
  ["AA", "AA"],
  ["TsTh", "TT"],
  ["a k s", "AKS"],
  ["a5s", "A5S"],
];

for (const [input, expected] of cases) {
  const out = normalizeHandLabel(input);
  console.log(`${input} -> ${out}`);
  assert.strictEqual(out, expected, `Expected ${expected} for ${input}, got ${out}`);
}

console.log("All normalizeHandLabel tests passed.");
