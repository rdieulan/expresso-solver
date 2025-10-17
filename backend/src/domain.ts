import assert from "assert";

export type PlayersCount = 2 | 3;

export enum Position {
    BTN = "BTN",
    SB = "SB",
    BB = "BB",
}

export enum Scenario {
    Open = "Open",
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

// Normalisation des mains : accepte plusieurs formats et renvoie un label standardisé.
// Exemples d'input acceptés :
//  - "AhKs" => "AKO"
//  - "AKs"  => "AKS"
//  - "A K s" => "AKS"
//  - "AA" => "AA"
//  - "10s" ou "Ts" pour dix
// Règles/assomptions :
//  - Si l'entrée contient deux cartes complètes (rank+suite), on détecte suited vs offsuit à partir des suites.
//  - Si l'entrée est du type shorthand (deux ranks + suffix s/o), on utilise le suffix pour suited/offsuit.
//  - Si aucun suffix ni suites n'est présent (ex: "AK"), on choisit OFFSUIT par défaut (option conservatrice).
//  - Les ranks sont ordonnés décroissant (A>K>Q...) dans le label (ex: KA -> AK).
export function normalizeHandLabel(hand: string): string {
    if (!hand || typeof hand !== "string") throw new Error("hand doit être une chaîne non vide");
    const raw = hand.trim();
    // Remplacer les séparateurs courants
    const s = raw.replace(/\s+/g, "").toUpperCase();

    // Ranks valides et mapping pour T
    const ranks = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

    // Cas : deux cartes complètes ex: AHKS ou AhKs (après upper -> AHKS)
    // On détecte si there are 4+ chars and they look like R S R S (rank+suit+rank+suit)
    const fullCardPattern = /^([AKQJT2-9])([CDHS])([AKQJT2-9])([CDHS])$/i;
    const mFull = s.match(fullCardPattern);
    if (mFull) {
        const r1 = mFull[1].toUpperCase();
        const r2 = mFull[3].toUpperCase();
        const su1 = mFull[2].toUpperCase();
        const su2 = mFull[4].toUpperCase();

        if (r1 === r2) return r1 + r2; // paire

        // Ordre décroissant
        const ordered = orderRanks(r1, r2, ranks);
        const suited = su1 === su2 ? "S" : "O";
        return ordered[0] + ordered[1] + suited;
    }

    // Cas shorthand : ex AKs, AKo, AA, 22
    // On peut avoir 2 ou 3 caractères: 2 pour paires (AA), 3 pour AKs
    const shortPattern = /^([AKQJT2-9])([AKQJT2-9])(S|O)?$/i;
    const mShort = s.match(shortPattern);
    if (mShort) {
        const r1 = mShort[1].toUpperCase();
        const r2 = mShort[2].toUpperCase();
        const suf = (mShort[3] || "").toUpperCase();

        if (r1 === r2) return r1 + r2;

        const ordered = orderRanks(r1, r2, ranks);
        const suited = suf === "S" ? "S" : suf === "O" ? "O" : "O"; // default OFFSUIT
        return ordered[0] + ordered[1] + suited;
    }

    // Cas où l'utilisateur a fourni des cartes avec deux lettres par carte sans séparateur (ex AHKS mais pattern different), ou autres formats
    // Tentative basique de parsing permissif : extraire les ranks et les suits si présents
    const tokens = s.split("");
    const extractedRanks: string[] = [];
    const extractedSuits: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const ch = tokens[i];
        if (ranks.includes(ch)) {
            extractedRanks.push(ch);
            // si next char est un suit
            const next = tokens[i + 1];
            if (next && /[CDHS]/i.test(next)) {
                extractedSuits.push(next.toUpperCase());
                i++; // sauter le suit
            }
            if (extractedRanks.length === 2) break;
        }
    }
    if (extractedRanks.length === 2) {
        const [r1, r2] = extractedRanks.map((r) => r.toUpperCase());
        if (r1 === r2) return r1 + r2;
        const ordered = orderRanks(r1, r2, ranks);
        let suited = "O";
        if (extractedSuits.length === 2) suited = extractedSuits[0] === extractedSuits[1] ? "S" : "O";
        return ordered[0] + ordered[1] + suited;
    }

    throw new Error(`Format de main non reconnu: ${hand}`);
}

function orderRanks(a: string, b: string, ranks: string[]): [string, string] {
    const ai = ranks.indexOf(a);
    const bi = ranks.indexOf(b);
    if (ai === -1 || bi === -1) throw new Error(`Rank invalide: ${a} ou ${b}`);
    return ai <= bi ? [a, b] : [b, a];
}

// Petites assertions dev (ne jettent rien en prod)
assert.ok(allVillainPositions(2, Position.SB).includes(Position.BB));
