export type DecisionAction = "fold" | "call" | "raise" | "shove";

export type HandLabel = string; // ex: "AKS", "A2O", "AA"

// A DecisionValue can be a simple action string, or a map of action->weight (numbers)
export type DecisionValue = DecisionAction | Record<DecisionAction, number> | string;

export type FirstInNode = Record<HandLabel, DecisionValue>;

export type VsNode = Record<string, Record<HandLabel, DecisionValue>>; // villainPos -> (hand->action)

export type PositionNode = {
  FirstIn?: FirstInNode;
  VsOpen?: VsNode;
  VsShove?: VsNode;
};

export type DepthNode = Record<string, PositionNode>; // position -> PositionNode

export type PlayersNode = Record<string, DepthNode>; // depth -> DepthNode

export type RangesFile = Record<string, PlayersNode>; // players -> PlayersNode
