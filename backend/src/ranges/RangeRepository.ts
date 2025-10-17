import { promises as fs } from "fs";
import path from "path";
import {
  RangesFile,
  DecisionAction,
  PositionNode,
  DecisionValue,
} from "./types";
import { PlayersCount, Position, Scenario } from "../domain";

export { DecisionAction, DecisionValue };

export class RangeRepository {
  private constructor(private readonly data: RangesFile) {}

  static async fromFile(filePath: string): Promise<RangeRepository> {
    const abs = path.resolve(filePath);
    const raw = await fs.readFile(abs, "utf8");
    let json: unknown;
    try {
      // Allow comments? The file currently contains pure JSON; parse strictly
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Erreur de parsing JSON pour ${abs}: ${(e as Error).message}`);
    }

    // Validation légère
    validateRangesFile(json, abs);

    return new RangeRepository(json as RangesFile);
  }

  // Create repository from an in-memory object (used for upload)
  static fromObject(obj: unknown): RangeRepository {
    // validate
    validateRangesFile(obj, "<uploaded>");
    return new RangeRepository(obj as RangesFile);
  }

  find(params: {
    players: PlayersCount;
    depth: number;
    heroPos: Position;
    scenario: Scenario;
    handLabel: string;
    villainPos?: Position;
  }): DecisionValue | undefined {
    const { players, depth, heroPos, scenario, handLabel, villainPos } = params;

    const pNode = (this.data as any)?.[String(players)];
    if (!pNode) return undefined;

    const dKey = this.closestDepthKey(pNode, depth);
    if (!dKey) return undefined;

    const dNode = pNode?.[dKey];
    if (!dNode) return undefined;

    const hNode = dNode?.[heroPos];
    if (!hNode) return undefined;

    if (scenario === Scenario.Open) {
      return (hNode as any)?.[Scenario.Open]?.[handLabel];
    }

    const sNode = (hNode as any)?.[scenario];
    if (!sNode) return undefined;

    // If sNode is structured by villain positions (VsOpen, VsShove, VsSqueeze, ...)
    if (villainPos && (sNode as any)[villainPos]) {
      return (sNode as any)[villainPos]?.[handLabel];
    }

    // If sNode directly maps handLabel -> value (no villain dimension), return that
    if ((sNode as any)[handLabel] !== undefined) {
      return (sNode as any)[handLabel];
    }

    // As a final attempt, if sNode has keys that look like villain positions but none matched, return undefined
    return undefined;
  }

  // Expose the raw position node (Open / VsOpen / VsShove) for the closest depth key
  getPositionNode(params: { players: PlayersCount; depth: number; heroPos: Position }): PositionNode | undefined {
    const { players, depth, heroPos } = params;
    const pNode = (this.data as any)?.[String(players)];
    if (!pNode) return undefined;
    const dKey = this.closestDepthKey(pNode, depth);
    if (!dKey) return undefined;
    const dNode = pNode?.[dKey];
    if (!dNode) return undefined;
    return dNode?.[heroPos] as PositionNode | undefined;
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

function validateRangesFile(json: unknown, srcPath: string): void {
  if (typeof json !== "object" || json === null) {
    throw new Error(`Fichier de ranges invalide (${srcPath}): racine doit être un objet`);
  }
  const root = json as Record<string, unknown>;
  // Expect keys like "2" or "3"
  for (const playersKey of Object.keys(root)) {
    const playersNode = root[playersKey];
    if (typeof playersNode !== "object" || playersNode === null) {
      throw new Error(`Node ${playersKey} invalide: doit être un objet depth->positions`);
    }
    const depths = Object.keys(playersNode as Record<string, unknown>);
    if (depths.length === 0) {
      throw new Error(`Players ${playersKey} n'a pas de niveaux de profondeur`);
    }
    for (const depthKey of depths) {
      const depthNode = (playersNode as Record<string, unknown>)[depthKey];
      if (typeof depthNode !== "object" || depthNode === null) {
        throw new Error(`Depth ${depthKey} pour players ${playersKey} invalide`);
      }
      // Check positions inside depthNode
      for (const posKey of Object.keys(depthNode as Record<string, unknown>)) {
        const posNode = (depthNode as Record<string, unknown>)[posKey];
        if (typeof posNode !== "object" || posNode === null) {
          throw new Error(`Position node ${posKey} invalide sous depth ${depthKey}`);
        }
        // posNode may contain Open, VsOpen, VsShove or other scenario keys (e.g. VsSqueeze).
        // Instead of hardcoding allowed scenario keys, validate structure per-scenario type:
        // - If the key is 'Open' (or matches /^Open$/i) then it must be an object hand->action
        // - Otherwise assume it's a multi-villain mapping: villainPos -> (hand->action)
        let hasAny = false;
        for (const scKey of Object.keys(posNode as Record<string, unknown>)) {
          hasAny = true;
          const scNode = (posNode as Record<string, unknown>)[scKey];
          if (scKey === "Open") {
            if (typeof scNode !== "object" || scNode === null) {
              throw new Error(`Open doit être un objet hand->action sous ${posKey}/${depthKey}`);
            }
          } else {
            // For non-Open scenarios we expect a villainPos -> (hand->action) mapping
            if (typeof scNode !== "object" || scNode === null) {
              throw new Error(`${scKey} doit être un objet villainPos->(hand->action) sous ${posKey}/${depthKey}`);
            }
            for (const villainPos of Object.keys(scNode as Record<string, unknown>)) {
              const vNode = (scNode as Record<string, unknown>)[villainPos];
              if (typeof vNode !== "object" || vNode === null) {
                throw new Error(`Noeud pour villainPos ${villainPos} invalide sous ${scKey}/${posKey}/${depthKey}`);
              }
            }
          }
        }
        if (!hasAny) {
          throw new Error(`Position ${posKey} sous depth ${depthKey} n'a aucun scenario (ex: Open ou Vs...)`);
        }
      }
    }
  }
}
