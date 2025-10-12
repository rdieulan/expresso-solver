#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import path from "path";
import {
    allVillainPositions,
    parsePlayersCount,
    parsePosition,
    Position,
    Scenario,
} from "./domain";
import { RangeRepository } from "./ranges/RangeRepository";
import { DecisionEngine } from "./DecisionEngine";

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("players", { type: "number", choices: [2, 3], demandOption: true, describe: "Nombre de joueurs: 2|3" })
        .option("depth", { type: "number", demandOption: true, describe: "Profondeur en bb: 5..15" })
        .option("position", { type: "string", choices: ["BTN", "SB", "BB"], demandOption: true, describe: "Position hero" })
        .option("hand", { type: "string", demandOption: true, describe: "Main hero, ex: AhKs" })
        .help()
        .strict()
        .parse();

    const players = parsePlayersCount(Number(argv.players));
    const heroPos = parsePosition(String(argv.position), players);
    const depth = Math.max(5, Math.min(15, Math.round(Number(argv.depth))));
    const hand = String(argv.hand);

    const rangesPath = path.resolve(__dirname, "..", "data", "preflop.ranges.json");
    const repo = await RangeRepository.fromFile(rangesPath);
    const engine = new DecisionEngine(repo);

    const results: { scenario: Scenario; villain?: Position; action: string; hand: string }[] = [];

    // firstIn (pas de vilain)
    {
        const d = engine.decide({
            players,
            depth,
            heroPos,
            scenario: Scenario.FirstIn,
            hand,
        });
        results.push({ scenario: Scenario.FirstIn, action: d.action, hand: d.handLabel });
    }

    // vsOpen et vsShove pour chaque vilain possible (positions ≠ hero)
    for (const v of allVillainPositions(players, heroPos)) {
        const dOpen = engine.decide({
            players,
            depth,
            heroPos,
            scenario: Scenario.VsOpen,
            villainPos: v,
            hand,
        });
        results.push({ scenario: Scenario.VsOpen, villain: v, action: dOpen.action, hand: dOpen.handLabel });

        const dShove = engine.decide({
            players,
            depth,
            heroPos,
            scenario: Scenario.VsShove,
            villainPos: v,
            hand,
        });
        results.push({ scenario: Scenario.VsShove, villain: v, action: dShove.action, hand: dShove.handLabel });
    }

    // Affichage
    for (const r of results) {
        const tag = r.villain ? `${r.scenario} vs ${r.villain}` : `${r.scenario}`;
        console.log(`[${tag}] ${r.hand} -> ${r.action}`);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
