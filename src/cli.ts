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
    normalizeHandLabel,
} from "./domain";
import { RangeRepository } from "./ranges/RangeRepository";
import { DecisionEngine } from "./DecisionEngine";

type OutputFormat = "text" | "json";

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("players", { type: "number", choices: [2, 3], demandOption: true, describe: "Nombre de joueurs: 2|3" })
        .option("depth", { type: "number", demandOption: true, describe: "Profondeur en bb: 5..15" })
        .option("position", { type: "string", choices: ["BTN", "SB", "BB"], demandOption: true, describe: "Position hero" })
        .option("hand", { type: "string", demandOption: true, describe: "Main hero, ex: AhKs" })
        .option("format", { type: "string", choices: ["text", "json"], default: "text", describe: "Format de sortie: text (lisible) ou json" })
        .option("show-range", { type: "boolean", default: false, describe: "Afficher la range complète pour la position/depth choisie" })
        .help()
        .strict()
        .parse();

    const players = parsePlayersCount(Number(argv.players));
    const heroPos = parsePosition(String(argv.position), players);
    const depth = Math.max(5, Math.min(15, Math.round(Number(argv.depth))));
    const handInput = String(argv.hand);
    const normalizedHand = normalizeHandLabel(handInput);
    const format: OutputFormat = (argv.format as OutputFormat) || "text";
    const showRange: boolean = Boolean(argv["show-range"]);

    const rangesPath = path.resolve(__dirname, "..", "data", "preflop.ranges.json");
    const repo = await RangeRepository.fromFile(rangesPath);
    const engine = new DecisionEngine(repo);

    // If showRange requested, fetch the position node
    const posNode = repo.getPositionNode({ players, depth, heroPos });

    // Collect decisions
    const decisions: Array<{ scenario: Scenario; villain?: Position; action: string; hand: string }> = [];

    // FirstIn
    const dFirst = engine.decide({ players, depth, heroPos, scenario: Scenario.FirstIn, hand: handInput });
    decisions.push({ scenario: Scenario.FirstIn, action: dFirst.action, hand: dFirst.handLabel });

    // For each villain
    const villains = allVillainPositions(players, heroPos);
    for (const v of villains) {
        const dOpen = engine.decide({ players, depth, heroPos, scenario: Scenario.VsOpen, villainPos: v, hand: handInput });
        decisions.push({ scenario: Scenario.VsOpen, villain: v, action: dOpen.action, hand: dOpen.handLabel });

        const dShove = engine.decide({ players, depth, heroPos, scenario: Scenario.VsShove, villainPos: v, hand: handInput });
        decisions.push({ scenario: Scenario.VsShove, villain: v, action: dShove.action, hand: dShove.handLabel });
    }

    // Output JSON
    if (format === "json") {
        const out: any = {
            meta: {
                players,
                depth,
                heroPos,
                handInput,
                normalizedHand,
            },
            decisions: decisions.map((d) => ({
                scenario: d.scenario,
                villain: d.villain || null,
                hand: d.hand,
                action: d.action,
            })),
        };
        if (showRange) {
            out.range = posNode || null;
        }
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    // Text output (lisible)
    console.log("==============================");
    console.log(`Décisions préflop — players=${players}, profondeur=${depth}bb, hero=${heroPos}, main=${handInput} (norm: ${normalizedHand})`);
    console.log("==============================\n");

    // If showRange, print it first
    if (showRange) {
        console.log("-- Range (noeud utilisé) --");
        if (!posNode) {
            console.log("Aucune range disponible pour ces paramètres.\n");
        } else {
            // Print FirstIn
            if (posNode.FirstIn) {
                console.log("FirstIn:");
                for (const h of Object.keys(posNode.FirstIn).sort()) {
                    console.log(`  ${h} -> ${(posNode.FirstIn as any)[h]}`);
                }
                console.log("");
            }
            // Print VsOpen / VsShove
            for (const sc of ["VsOpen", "VsShove"] as const) {
                const scNode = (posNode as any)[sc];
                if (scNode) {
                    console.log(`${sc}:`);
                    for (const villainPos of Object.keys(scNode)) {
                        console.log(`  contre ${villainPos}:`);
                        const map = scNode[villainPos] as Record<string, string>;
                        for (const h of Object.keys(map).sort()) {
                            console.log(`    ${h} -> ${map[h]}`);
                        }
                    }
                    console.log("");
                }
            }
        }
        console.log("---- Fin de la range ----\n");
    }

    // FirstIn
    const first = decisions.find((d) => d.scenario === Scenario.FirstIn && !d.villain)!;
    console.log("-- FirstIn --");
    console.log(`${first.hand} -> ${first.action}\n`);

    // Group by villain
    for (const v of villains) {
        console.log(`-- Contre ${v} --`);
        const open = decisions.find((d) => d.scenario === Scenario.VsOpen && d.villain === v)!;
        const shove = decisions.find((d) => d.scenario === Scenario.VsShove && d.villain === v)!;
        console.log(`VsOpen: ${open.hand} -> ${open.action}`);
        console.log(`VsShove: ${shove.hand} -> ${shove.action}\n`);
    }

    console.log("Fin des décisions.");
}

main().catch((e) => {
    console.error("Erreur:", e && (e as Error).message ? (e as Error).message : e);
    process.exit(1);
});
