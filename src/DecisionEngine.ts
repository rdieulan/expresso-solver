import { PlayersCount, Position, Scenario, normalizeHandLabel } from "./domain";
import { DecisionValue, DecisionAction, RangeRepository } from "./ranges/RangeRepository";

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
    probs?: Record<DecisionAction, number>;
};

export class DecisionEngine {
    constructor(private readonly ranges: RangeRepository) {}

    decide(input: DecideInput): DecideOutput {
        const handLabel = normalizeHandLabel(input.hand);

        const raw = this.ranges.find({
            players: input.players,
            depth: input.depth,
            heroPos: input.heroPos,
            scenario: input.scenario,
            handLabel,
            villainPos: input.villainPos,
        }) as DecisionValue | undefined;

        if (!raw) {
            // fallback deterministic
            const fallbackAction = this.fallback(input.scenario);
            return { action: fallbackAction, handLabel };
        }

        const { probs, action } = this.resolveDecisionValue(raw);
        const out: DecideOutput = { action, handLabel };
        if (probs) out.probs = probs;
        return out;
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

    // Resolve DecisionValue into a sampled action and the distribution
    private resolveDecisionValue(val: DecisionValue): { action: DecisionAction; probs?: Record<DecisionAction, number> } {
        // If val is a plain string matching an action
        if (typeof val === "string") {
            const s = val.trim().toLowerCase();

            // Try action name
            const a = this.asAction(s);
            if (a) {
                const probs: Record<DecisionAction, number> = { fold: 0, call: 0, raise: 0, shove: 0 };
                probs[a] = 1;
                return { action: a, probs };
            }

            // Otherwise try to parse as JSON representation of a weights object
            try {
                const maybe = JSON.parse(val as string);
                if (typeof maybe === 'object' && maybe !== null) {
                    const probs = this.normalizeWeights(maybe as Record<string, number>);
                    const action = this.sampleFromProbs(probs);
                    return { action, probs };
                }
            } catch (e) {
                // ignore
            }

            // Unknown string -> fallback
            return { action: "fold", probs: undefined };
        }

        // If val is object map of action->weight
        if (typeof val === 'object' && val !== null) {
            const probs = this.normalizeWeights(val as Record<string, number>);
            const action = this.sampleFromProbs(probs);
            return { action, probs };
        }

        // fallback
        return { action: "fold", probs: undefined };
    }

    private asAction(s: string): DecisionAction | null {
        const mapping: Record<string, DecisionAction> = {
            'fold': 'fold',
            'call': 'call',
            'raise': 'raise',
            'shove': 'shove',
            'shove!': 'shove'
        };
        return mapping[s] ?? null;
    }

    private normalizeWeights(obj: Record<string, number>): Record<DecisionAction, number> {
        const out: Record<DecisionAction, number> = { fold: 0, call: 0, raise: 0, shove: 0 };
        let total = 0;
        for (const k of Object.keys(obj)) {
            const name = k.toLowerCase();
            const w = Number(obj[k]);
            if (!Number.isFinite(w) || w <= 0) continue;
            const a = this.asAction(name);
            if (a) {
                out[a] = out[a] + w;
                total += w;
            }
        }
        if (total <= 0) return out;
        // normalize to sum 1
        for (const k of Object.keys(out) as DecisionAction[]) {
            out[k] = out[k] / total;
        }
        return out;
    }

    private sampleFromProbs(probs: Record<DecisionAction, number>): DecisionAction {
        // Ensure sum to 1 (allow small float drift)
        const eps = 1e-12;
        let total = 0;
        for (const k of Object.keys(probs) as DecisionAction[]) total += probs[k] || 0;
        if (total <= eps) return 'fold';
        // normalize
        const normalized: Record<DecisionAction, number> = { fold: 0, call: 0, raise: 0, shove: 0 };
        for (const k of Object.keys(probs) as DecisionAction[]) normalized[k] = (probs[k] || 0) / total;
        const r = Math.random();
        let acc = 0;
        for (const k of ['fold', 'call', 'raise', 'shove'] as DecisionAction[]) {
            acc += normalized[k];
            if (r <= acc) return k;
        }
        return 'shove';
    }
}
