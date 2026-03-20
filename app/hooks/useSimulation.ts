"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INITIAL_AVS_SERVICES, INITIAL_VALIDATORS } from "@/app/lib/data";
import { computeMetrics } from "@/app/lib/simulation";
import { layoutNodes } from "@/app/lib/canvas";
import type {
  AVSService,
  LogEntry,
  NetworkMetrics,
  SimulateResponse,
  SimulationPhase,
  SimulationStep,
  Validator,
} from "@/app/types";

const STEP_INTERVAL_MS = 1400;

function freshMetrics(): NetworkMetrics {
  return {
    totalSlashedStake: 0,
    cascadeDepth: 0,
    affectedValidators: 0,
    totalValidators: INITIAL_VALIDATORS.length,
    attackerProfitEstimate: 0,
    meanRestakingDegree: parseFloat(
      (
        INITIAL_VALIDATORS.reduce((s, v) => s + v.services.length, 0) /
        INITIAL_VALIDATORS.length
      ).toFixed(2)
    ),
    riskScore: 0,
    networkHealthPct: 100,
  };
}

export function useSimulation(canvasWidth: number, canvasHeight: number) {
  const [phase, setPhase] = useState<SimulationPhase>("idle");
  const [byzantineAvsId, setByzantineAvsId] = useState<string | null>(null);
  const [validators, setValidators] = useState<Validator[]>(() =>
    INITIAL_VALIDATORS.map((v) => ({ ...v, services: [...v.services] }))
  );
  const [avsServices, setAvsServices] = useState<AVSService[]>(() =>
    INITIAL_AVS_SERVICES.map((a) => ({ ...a }))
  );
  const [metrics, setMetrics] = useState<NetworkMetrics>(freshMetrics);
  const [log, setLog] = useState<LogEntry[]>([
    {
      id: "init-1",
      timestamp: 0,
      message: "StakeGuard initialized. Network loaded with 6 validators and 5 AVS services.",
      level: "info",
      phase: "idle",
    },
    {
      id: "init-2",
      timestamp: 0,
      message: "Select an AVS to mark as Byzantine, then run the simulation.",
      level: "neutral",
      phase: "idle",
    },
  ]);
  const [recommendation, setRecommendation] = useState(
    "No active threats detected. Network is operating within safe parameters."
  );
  const [isRunning, setIsRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const stepsRef = useRef<SimulationStep[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Re-layout when canvas size changes ──────────────────────────────────
  useEffect(() => {
    if (canvasWidth === 0 || canvasHeight === 0) return;
    setValidators((vs) => {
      const { validators: lv, avsServices: la } = layoutNodes(
        vs,
        avsServices,
        canvasWidth,
        canvasHeight
      );
      setAvsServices(la);
      return lv;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight]);

  const appendLog = useCallback((entries: LogEntry[]) => {
    setLog((prev) => [...prev, ...entries]);
  }, []);

  const applyStep = useCallback(
    (step: SimulationStep, canvasW: number, canvasH: number) => {
      const { validators: lv, avsServices: la } = layoutNodes(
        step.validatorSnapshot,
        step.avsSnapshot,
        canvasW,
        canvasH
      );
      setValidators(lv);
      setAvsServices(la);
      setMetrics(step.metrics);
      setPhase(step.phase);
      appendLog(step.events);
    },
    [appendLog]
  );

  // ── Lock target ──────────────────────────────────────────────────────────
  const lockTarget = useCallback(
    (avsId: string) => {
      setByzantineAvsId(avsId);
      setPhase("target_locked");
      const avs = INITIAL_AVS_SERVICES.find((a) => a.id === avsId);
      appendLog([
        {
          id: `lock-${Date.now()}`,
          timestamp: Date.now(),
          message: `Byzantine target locked: ${avs?.name ?? avsId}. Press ▶ Run Simulation to begin.`,
          level: "info",
          phase: "target_locked",
        },
      ]);
    },
    [appendLog]
  );

  // ── Fetch simulation steps from API ─────────────────────────────────────
  const fetchSimulation = useCallback(
    async (avsId: string): Promise<SimulateResponse | null> => {
      try {
        const res = await fetch("/api/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            byzantineAvsId: avsId,
            validators: INITIAL_VALIDATORS,
            avsServices: INITIAL_AVS_SERVICES,
            slashPercentage: 0.3,
          }),
        });
        if (!res.ok) throw new Error("API error");
        return res.json();
      } catch (e) {
        console.error(e);
        return null;
      }
    },
    []
  );

  // ── Run / Pause ──────────────────────────────────────────────────────────
  const runSimulation = useCallback(async () => {
    if (!byzantineAvsId) return;

    if (isRunning) {
      // Pause
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRunning(false);
      return;
    }

    // If no steps cached yet, fetch
    if (stepsRef.current.length === 0) {
      const result = await fetchSimulation(byzantineAvsId);
      if (!result) return;
      stepsRef.current = result.steps;
      setRecommendation(result.recommendation);
    }

    setIsRunning(true);
    let idx = stepIndex;

    const advance = () => {
      if (idx >= stepsRef.current.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRunning(false);
        return;
      }
      applyStep(stepsRef.current[idx], canvasWidth, canvasHeight);
      setStepIndex(idx + 1);
      idx++;
    };

    advance(); // immediate first step
    timerRef.current = setInterval(advance, STEP_INTERVAL_MS);
  }, [
    byzantineAvsId,
    isRunning,
    stepIndex,
    fetchSimulation,
    applyStep,
    canvasWidth,
    canvasHeight,
  ]);

  // ── Manual step ─────────────────────────────────────────────────────────
  const stepForward = useCallback(async () => {
    if (!byzantineAvsId) return;

    if (stepsRef.current.length === 0) {
      const result = await fetchSimulation(byzantineAvsId);
      if (!result) return;
      stepsRef.current = result.steps;
      setRecommendation(result.recommendation);
    }

    if (stepIndex >= stepsRef.current.length) return;
    applyStep(stepsRef.current[stepIndex], canvasWidth, canvasHeight);
    setStepIndex((i) => i + 1);
  }, [byzantineAvsId, fetchSimulation, stepIndex, applyStep, canvasWidth, canvasHeight]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    stepsRef.current = [];

    const fresh = INITIAL_VALIDATORS.map((v) => ({ ...v, services: [...v.services] }));
    const freshAVS = INITIAL_AVS_SERVICES.map((a) => ({ ...a }));

    const { validators: lv, avsServices: la } = layoutNodes(
      fresh,
      freshAVS,
      canvasWidth,
      canvasHeight
    );

    setValidators(lv);
    setAvsServices(la);
    setPhase("idle");
    setByzantineAvsId(null);
    setMetrics(freshMetrics());
    setStepIndex(0);
    setIsRunning(false);
    setRecommendation("No active threats detected. Network is operating within safe parameters.");
    setLog([
      {
        id: `reset-${Date.now()}`,
        timestamp: Date.now(),
        message: "Network reset. All validators and AVS services restored to nominal state.",
        level: "safe",
        phase: "idle",
      },
    ]);
  }, [canvasWidth, canvasHeight]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    phase,
    byzantineAvsId,
    validators,
    avsServices,
    metrics,
    log,
    recommendation,
    isRunning,
    stepIndex,
    totalSteps: stepsRef.current.length,
    lockTarget,
    runSimulation,
    stepForward,
    reset,
  };
}
