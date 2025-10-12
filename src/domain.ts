import assert from "assert";

export type PlayersCount = 2 | 3;

export enum Position {
    BTN = "BTN",
    SB = "SB",
    BB = "BB",
}

export enum Scenario {
    FirstIn = "FirstIn",
    VsOpen = "VsOpen",
    VsShove = "VsShove",
}

export function parsePlayersCount(n: number): PlayersCount {
    if (n !== 2 && n !== 3) {
        throw new Error(`players doit être 2 ou 3, reçu: ${n}`);
    }
    return n as PlayersCount;
}

export function parsePosition(pos: string, players: PlayersCount): Position {
    const p = pos.toUpperCase();
    const allowed = allowedPositions(players);
    if (!allowed.includes(p as Position)) {
        throw new Error(`Position invalide pour ${players} joueurs: ${pos}`);
    }
    return p as Position;
}

export function allowedPositions(players: PlayersCount): Position[] {
    return players === 2 ? [Position.SB, Position.BB] : [Position.BTN, Position.SB, Position.BB];
}

export function allVillainPositions(players: PlayersCount, heroPos: Position): Position[] {
    return allowedPositions(players).filter((p) => p !== heroPos);
}

export function normalizeHandLabel(hand: string): string {
    return hand.trim().toUpperCase();
}

// Petites assertions dev (ne jettent rien en prod)
assert.ok(allVillainPositions(2, Position.SB).includes(Position.BB));
