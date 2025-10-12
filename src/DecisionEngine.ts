import { PlayersCount, Position, Scenario, normalizeHandLabel } from "./domain";
import { DecisionAction, RangeRepository } from "./ranges/RangeRepository";

export type DecideInput = {
    players: PlayersCount;
    depth: number;
    heroPos: Position;
    scenario: Scenario;
    hand: string;
    villainPos?: Position;
};

export type DecideOutput = {
    action: DecisionAction;
    handLabel: string;
};

export class DecisionEngine {
    constructor(private readonly ranges: RangeRepository) {}

    decide(input: DecideInput): DecideOutput {
        const handLabel = normalizeHandLabel(input.hand);

        const action =
            this.ranges.find({
                players: input.players,
                depth: input.depth,
                heroPos: input.heroPos,
                scenario: input.scenario,
                handLabel,
                villainPos: input.villainPos,
            }) ?? this.fallback(input.scenario);

        return { action, handLabel };
    }

    private fallback(s: Scenario): DecisionAction {
        // Repli conservateur
        switch (s) {
            case Scenario.FirstIn:
                return "fold";
            case Scenario.VsOpen:
                return "fold";
            case Scenario.VsShove:
                return "call";
            default:
                return "fold";
        }
    }
}
