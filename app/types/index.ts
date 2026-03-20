// ─── Core Domain Types ────────────────────────────────────────────────────────

export type NodeStatus = "normal" | "at_risk" | "slashed" | "byzantine";

export interface Validator {
  id: string;
  name: string;
  stake: number;         // ETH
  color: string;
  services: string[];    // AVS IDs this validator is allocated to
  x: number;
  y: number;
  slashedStake: number;
  status: NodeStatus;
}

export interface AVSService {
  id: string;
  name: string;
  tvl: number;           // ETH
  rewardAPY: number;     // %
  color: string;
  status: NodeStatus;
  x: number;
  y: number;
  description: string;
}

// ─── Simulation Types ─────────────────────────────────────────────────────────

export type SimulationPhase =
  | "idle"
  | "target_locked"
  | "phase1_flag"
  | "phase2_slash"
  | "phase3_cascade"
  | "complete";

export interface SimulationStep {
  phase: SimulationPhase;
  timestamp: number;
  events: LogEntry[];
  validatorSnapshot: Validator[];
  avsSnapshot: AVSService[];
  metrics: NetworkMetrics;
}

export interface NetworkMetrics {
  totalSlashedStake: number;
  cascadeDepth: number;
  affectedValidators: number;
  totalValidators: number;
  attackerProfitEstimate: number;
  meanRestakingDegree: number;
  riskScore: number;               // 0–100
  networkHealthPct: number;        // 0–100
}

// ─── Log Types ────────────────────────────────────────────────────────────────

export type LogLevel = "info" | "warn" | "danger" | "safe" | "neutral";

export interface LogEntry {
  id: string;
  timestamp: number;       // ms since sim start
  message: string;
  level: LogLevel;
  phase: SimulationPhase;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  byzantineAvsId: string;
  validators: Validator[];
  avsServices: AVSService[];
  slashPercentage: number;   // default 0.30
}

export interface SimulateResponse {
  steps: SimulationStep[];
  finalMetrics: NetworkMetrics;
  recommendation: string;
  attackerProfit: number;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface SimulationState {
  phase: SimulationPhase;
  byzantineAvsId: string | null;
  validators: Validator[];
  avsServices: AVSService[];
  metrics: NetworkMetrics;
  log: LogEntry[];
  recommendation: string;
  stepIndex: number;
  steps: SimulationStep[];
  isRunning: boolean;
}
