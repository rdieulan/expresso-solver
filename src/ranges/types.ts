export type DecisionAction = "fold" | "call" | "raise" | "shove";

export type HandLabel = string; // ex: "AKS", "A2O", "AA"

export type FirstInNode = Record<HandLabel, DecisionAction>;

export type VsNode = Record<string, Record<HandLabel, DecisionAction>>; // villainPos -> (hand->action)

export type PositionNode = {
  FirstIn?: FirstInNode;
  VsOpen?: VsNode;
  VsShove?: VsNode;
};

export type DepthNode = Record<string, PositionNode>; // position -> PositionNode

export type PlayersNode = Record<string, DepthNode>; // depth -> DepthNode

export type RangesFile = Record<string, PlayersNode>; // players -> PlayersNode

