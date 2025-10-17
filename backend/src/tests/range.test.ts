import assert from "assert";
import path from "path";
import { RangeRepository } from "../ranges/RangeRepository";
import { PlayersCount, Position, Scenario } from "../domain";

async function run() {
  const fp = path.resolve(__dirname, "..", "..", "data", "ranges.json");
  const repo = await RangeRepository.fromFile(fp);

  // Cas 1: SB firstIn AKs (players=2, depth=10)
  const a1 = repo.find({
    players: 2 as PlayersCount,
    depth: 10,
    heroPos: Position.SB,
    scenario: Scenario.FirstIn,
    handLabel: "AKS",
  });
  console.log(`find SB FirstIn AKS -> ${a1}`);
  assert.strictEqual(a1, "raise" , "Expected raise for SB FirstIn AKS (from data)");

  // Cas 2: BB vsOpen vs SB AKS
  const a2 = repo.find({
    players: 2 as PlayersCount,
    depth: 10,
    heroPos: Position.BB,
    scenario: Scenario.VsOpen,
    villainPos: Position.SB,
    handLabel: "AKS",
  });
  console.log(`find BB VsOpen vs SB AKS -> ${a2}`);
  assert.strictEqual(a2, "shove", "Expected shove for BB VsOpen vs SB AKS (from data)");

  // Cas 3: closest depth (request depth 9 -> should pick 10)
  const a3 = repo.find({
    players: 2 as PlayersCount,
    depth: 9,
    heroPos: Position.SB,
    scenario: Scenario.FirstIn,
    handLabel: "AA",
  });
  console.log(`find SB FirstIn AA (depth 9 -> pick 10) -> ${a3}`);
  assert.strictEqual(a3, "shove", "Expected shove for AA at depth closest 10");

  console.log("All RangeRepository tests passed.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

