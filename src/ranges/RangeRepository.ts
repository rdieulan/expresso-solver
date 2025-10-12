import { promises as fs } from "fs";
import path from "path";
import { PlayersCount, Position, Scenario } from "../domain";

type JsonValue = any;

export type DecisionAction = "fold" | "call" | "raise" | "shove";

export class RangeRepository {
    private constructor(private readonly data: JsonValue) {}

    static async fromFile(filePath: string): Promise<RangeRepository> {
        const abs = path.resolve(filePath);
        const raw = await fs.readFile(abs, "utf8");
        const json = JSON.parse(raw);
        return new RangeRepository(json);
    }

    find(params: {
        players: PlayersCount;
        depth: number;
        heroPos: Position;
        scenario: Scenario;
        handLabel: string;
        villainPos?: Position;
    }): DecisionAction | undefined {
        const { players, depth, heroPos, scenario, handLabel, villainPos } = params;

        const pNode = this.data?.[String(players)];
        if (!pNode) return undefined;

        const dKey = this.closestDepthKey(pNode, depth);
        if (!dKey) return undefined; // évite TS2538

        const dNode = pNode?.[dKey];
        if (!dNode) return undefined;

        const hNode = dNode?.[heroPos];
        if (!hNode) return undefined;

        if (scenario === Scenario.FirstIn) {
            return hNode?.[Scenario.FirstIn]?.[handLabel];
        }

        const sNode = hNode?.[scenario];
        if (!sNode || !villainPos) return undefined;

        return sNode?.[villainPos]?.[handLabel];
    }

    private closestDepthKey(node: Record<string, unknown>, depth: number): string | undefined {
        const keys = Object.keys(node);
        if (keys.length === 0) return undefined;
        const depths = keys
            .map((k) => Number(k))
            .filter((n) => !Number.isNaN(n));
        if (depths.length === 0) return undefined;

        let best = depths[0];
        let bestDelta = Math.abs(best - depth);
        for (let i = 1; i < depths.length; i++) {
            const d = depths[i];
            const delta = Math.abs(d - depth);
            if (delta < bestDelta) {
                best = d;
                bestDelta = delta;
            }
        }
        return String(best);
    }
}
