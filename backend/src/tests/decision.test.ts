import assert from "assert";
import path from "path";
import { RangeRepository } from "../ranges/RangeRepository";
import { DecisionEngine } from "../DecisionEngine";
import { PlayersCount, Position, Scenario } from "../domain";

async function run() {
  const fp = path.resolve(__dirname, "..", "..", "data", "ranges.json");
  const repo = await RangeRepository.fromFile(fp);
  const engine = new DecisionEngine(repo);

  // Test 1: FirstIn found in ranges
  const r1 = engine.decide({
    players: 2 as PlayersCount,
    depth: 10,
    heroPos: Position.SB,
    scenario: Scenario.FirstIn,
    hand: "AKs",
  });
  console.log(`Decision FirstIn SB AKs -> ${r1.action}`);
  assert.strictEqual(r1.action, "raise");

  // Test 2: VsOpen found
  const r2 = engine.decide({
    players: 2 as PlayersCount,
    depth: 10,
    heroPos: Position.BB,
    scenario: Scenario.VsOpen,
    villainPos: Position.SB,
    hand: "AKs",
  });
  console.log(`Decision BB VsOpen vs SB AKs -> ${r2.action}`);
  assert.strictEqual(r2.action, "shove");

  // Test 3: VsShove fallback when not found -> call (per DecisionEngine.fallback)
  const r3 = engine.decide({
    players: 3 as PlayersCount,
    depth: 10,
    heroPos: Position.BTN,
    scenario: Scenario.VsShove,
    villainPos: Position.SB,
    hand: "K2o",
  });
  console.log(`Decision BTN VsShove vs SB K2o -> ${r3.action}`);
  assert.strictEqual(r3.action, "call");

  console.log("All DecisionEngine tests passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

