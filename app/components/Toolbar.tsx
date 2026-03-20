"use client";

import { cn } from "@/app/lib/utils";
import type { SimulationPhase } from "@/app/types";

interface Props {
  phase: SimulationPhase;
  isRunning: boolean;
  byzantineAvsId: string | null;
  stepIndex: number;
  totalSteps: number;
  onRun: () => void;
  onStep: () => void;
}

export default function Toolbar({
  phase,
  isRunning,
  byzantineAvsId,
  stepIndex,
  totalSteps,
  onRun,
  onStep,
}: Props) {
  const canRun = !!byzantineAvsId && phase !== "complete";
  const canStep = !!byzantineAvsId && !isRunning && phase !== "complete";

  const statusText =
    phase === "idle"
      ? "IDLE — SELECT AN AVS TO ATTACK"
      : phase === "target_locked"
      ? `TARGET LOCKED — ${byzantineAvsId} — READY`
      : phase === "phase1_flag"
      ? "PHASE 1 — BYZANTINE FLAGGING"
      : phase === "phase2_slash"
      ? "PHASE 2 — SLASH WAVE PROPAGATING"
      : phase === "phase3_cascade"
      ? "PHASE 3 — CASCADE ANALYSIS"
      : "SIMULATION COMPLETE";

  const dotClass =
    isRunning
      ? "bg-danger animate-blink"
      : phase === "complete"
      ? "bg-safe"
      : phase !== "idle"
      ? "bg-accent"
      : "bg-muted";

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
      {/* Run / Pause */}
      <button
        onClick={onRun}
        disabled={!canRun}
        className={cn(
          "font-mono text-[11px] px-4 py-2 border tracking-widest uppercase transition-all",
          canRun && !isRunning && "border-accent text-accent hover:bg-accent hover:text-bg",
          isRunning && "border-danger text-white bg-danger animate-pulse-danger",
          !canRun && "border-border text-text-dim opacity-40 cursor-not-allowed"
        )}
      >
        {isRunning ? "⏸ PAUSE" : "▶ RUN SIMULATION"}
      </button>

      {/* Step */}
      <button
        onClick={onStep}
        disabled={!canStep}
        className={cn(
          "font-mono text-[11px] px-4 py-2 border tracking-widest uppercase transition-all",
          canStep
            ? "border-border text-text-dim hover:border-text hover:text-text"
            : "border-border text-text-dim opacity-30 cursor-not-allowed"
        )}
      >
        ⏭ STEP
      </button>

      {/* Step counter */}
      {totalSteps > 0 && (
        <div className="font-mono text-[10px] text-text-dim">
          {stepIndex}/{totalSteps}
        </div>
      )}

      <div className="flex-1" />

      {/* Status indicator */}
      <div className="flex items-center gap-2 font-mono text-[10px] text-text-dim">
        <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", dotClass)} />
        <span>{statusText}</span>
      </div>
    </div>
  );
}
