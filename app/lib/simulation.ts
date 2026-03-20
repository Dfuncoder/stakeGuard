import type {
  Validator,
  AVSService,
  SimulationStep,
  NetworkMetrics,
  LogEntry,
  SimulationPhase,
  SimulateRequest,
  SimulateResponse,
} from "@/app/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _logId = 0;
function makeLog(
  message: string,
  level: LogEntry["level"],
  phase: SimulationPhase,
  timestamp: number
): LogEntry {
  return { id: String(++_logId), message, level, phase, timestamp };
}

function cloneValidators(vs: Validator[]): Validator[] {
  return vs.map((v) => ({ ...v, services: [...v.services] }));
}

function cloneAVS(as: AVSService[]): AVSService[] {
  return as.map((a) => ({ ...a }));
}

export function computeMetrics(
  validators: Validator[],
  avsServices: AVSService[]
): NetworkMetrics {
  const totalStake = validators.reduce((s, v) => s + v.stake, 0);
  const totalSlashedStake = validators.reduce((s, v) => s + v.slashedStake, 0);
  const affectedValidators = validators.filter((v) => v.status !== "normal").length;
  // Only count services that are fully byzantine or cascaded (at_risk doesn't count as full cascade)
  const cascadeDepth = avsServices.filter((a) => a.status === "at_risk" || a.status === "byzantine").length;
  const nonByzantineCascade = avsServices.filter((a) => a.status === "at_risk").length;
  const attackerProfitEstimate = Math.round(totalSlashedStake * 0.05);
  const meanRestakingDegree = parseFloat(
    (validators.reduce((s, v) => s + v.services.length, 0) / validators.length).toFixed(2)
  );
  // Stake-weighted risk: primary slash impact (55%) + cascade breadth (45%)
  const maxOtherServices = Math.max(1, avsServices.length - 1);
  const primaryRisk = (totalSlashedStake / Math.max(1, totalStake)) * 55;
  const cascadeRisk = (nonByzantineCascade / maxOtherServices) * 45;
  const riskScore = Math.min(99, Math.round(primaryRisk + cascadeRisk));
  const networkHealthPct = Math.max(0, 100 - riskScore);

  return {
    totalSlashedStake,
    cascadeDepth,
    affectedValidators,
    totalValidators: validators.length,
    attackerProfitEstimate,
    meanRestakingDegree,
    riskScore,
    networkHealthPct,
  };
}

function generateRecommendation(
  metrics: NetworkMetrics,
  byzantineAvsId: string
): string {
  const { affectedValidators, totalValidators, riskScore, totalSlashedStake, cascadeDepth } = metrics;

  if (riskScore >= 70) {
    return `CRITICAL: ${affectedValidators}/${totalValidators} validators impacted by ${byzantineAvsId} failure. ` +
      `${totalSlashedStake.toLocaleString()} ETH slashed across ${cascadeDepth} services. ` +
      `Immediate action: (1) Reduce restaking degree on high-overlap validators to ≤2 services. ` +
      `(2) Implement stake isolation caps per AVS. (3) Activate emergency withdrawal queues.`;
  }
  if (riskScore >= 40) {
    return `WARNING: Cascade propagated through ${cascadeDepth} services. ` +
      `Consider setting per-service stake caps (recommended: max 40% of validator stake per AVS). ` +
      `Review shared allocations on validators with degree ≥3.`;
  }
  if (riskScore >= 15) {
    return `LOW RISK: Failure contained. ${affectedValidators} validator(s) affected. ` +
      `Current diversification is adequate but monitor ${byzantineAvsId} for further degradation.`;
  }
  return `NOMINAL: Failure isolated. The network's stake distribution and restaking degree ` +
    `successfully limited blast radius. No allocation changes required.`;
}

// ─── Main Simulation Engine ───────────────────────────────────────────────────

export function runSimulation(req: SimulateRequest): SimulateResponse {
  _logId = 0;
  const { byzantineAvsId, slashPercentage = 0.3 } = req;
  const steps: SimulationStep[] = [];
  const startTs = 0;

  // ── Step 0: Initial state ──────────────────────────────────────────────────
  {
    const validators = cloneValidators(req.validators);
    const avsServices = cloneAVS(req.avsServices);
    const metrics = computeMetrics(validators, avsServices);
    steps.push({
      phase: "target_locked",
      timestamp: startTs,
      events: [
        makeLog(`Byzantine target locked: ${byzantineAvsId}`, "info", "target_locked", 0),
        makeLog(`Network loaded — ${validators.length} validators, ${avsServices.length} AVS services.`, "neutral", "target_locked", 0),
        makeLog(`Mean restaking degree: ${metrics.meanRestakingDegree}. Simulation ready.`, "neutral", "target_locked", 0),
      ],
      validatorSnapshot: validators,
      avsSnapshot: avsServices,
      metrics,
    });
  }

  // ── Step 1: Mark Byzantine AVS ────────────────────────────────────────────
  {
    const validators = cloneValidators(steps[steps.length - 1].validatorSnapshot);
    const avsServices = cloneAVS(steps[steps.length - 1].avsSnapshot);
    const target = avsServices.find((a) => a.id === byzantineAvsId)!;
    target.status = "byzantine";

    const affectedCount = validators.filter((v) => v.services.includes(byzantineAvsId)).length;
    const metrics = computeMetrics(validators, avsServices);

    steps.push({
      phase: "phase1_flag",
      timestamp: 1200,
      events: [
        makeLog(`⚡ BYZANTINE FAILURE detected on ${target.name} (${byzantineAvsId})`, "danger", "phase1_flag", 1200),
        makeLog(`Slashing condition activated. ${affectedCount} validator(s) exposed to ${byzantineAvsId}.`, "warn", "phase1_flag", 1400),
        makeLog(`Alerting network participants. Preparing slashing proofs...`, "warn", "phase1_flag", 1600),
      ],
      validatorSnapshot: validators,
      avsSnapshot: avsServices,
      metrics,
    });
  }

  // ── Step 2: Slash exposed validators ─────────────────────────────────────
  {
    const validators = cloneValidators(steps[steps.length - 1].validatorSnapshot);
    const avsServices = cloneAVS(steps[steps.length - 1].avsSnapshot);
    const events: LogEntry[] = [];
    let totalSlashed = 0;

    validators.forEach((v) => {
      if (v.services.includes(byzantineAvsId)) {
        const slash = Math.round(v.stake * slashPercentage);
        v.slashedStake = slash;
        v.status = "slashed";
        totalSlashed += slash;
        events.push(
          makeLog(
            `SLASHED: ${v.id} (${v.name}) — ${slash.toLocaleString()} ETH (${Math.round(slashPercentage * 100)}% of stake)`,
            "danger",
            "phase2_slash",
            2400
          )
        );
      }
    });

    events.push(
      makeLog(
        `Slash wave complete. Total removed from network: ${totalSlashed.toLocaleString()} ETH`,
        "danger",
        "phase2_slash",
        2800
      )
    );

    const metrics = computeMetrics(validators, avsServices);
    steps.push({
      phase: "phase2_slash",
      timestamp: 2400,
      events,
      validatorSnapshot: validators,
      avsSnapshot: avsServices,
      metrics,
    });
  }

  // ── Step 3: Cascade propagation ───────────────────────────────────────────
  {
    const validators = cloneValidators(steps[steps.length - 1].validatorSnapshot);
    const avsServices = cloneAVS(steps[steps.length - 1].avsSnapshot);
    const events: LogEntry[] = [];

    // Cascade: a service degrades only if ≥50% of its validators are slashed
    const cascadedServiceIds = new Set<string>();
    avsServices
      .filter((a) => a.id !== byzantineAvsId && a.status === "normal")
      .forEach((a) => {
        const total = validators.filter((v) => v.services.includes(a.id)).length;
        const slashed = validators.filter(
          (v) => v.services.includes(a.id) && v.status === "slashed"
        ).length;
        if (total > 0 && slashed / total >= 0.5) {
          cascadedServiceIds.add(a.id);
        }
      });

    if (cascadedServiceIds.size > 0) {
      events.push(
        makeLog(
          `CASCADE DETECTED: ${cascadedServiceIds.size} service(s) lost ≥50% of their validators to slashing`,
          "danger",
          "phase3_cascade",
          3600
        )
      );

      cascadedServiceIds.forEach((sId) => {
        const avsNode = avsServices.find((a) => a.id === sId);
        if (avsNode) {
          avsNode.status = "at_risk";
          events.push(
            makeLog(
              `Security degraded: ${avsNode.name} (${sId}) — majority of validators slashed`,
              "warn",
              "phase3_cascade",
              3800
            )
          );
        }
      });

      // Secondary validators at risk
      const secondaryValidators = validators.filter(
        (v) =>
          v.status === "normal" &&
          v.services.some((s) => cascadedServiceIds.has(s))
      );
      secondaryValidators.forEach((v) => {
        v.status = "at_risk";
        events.push(
          makeLog(
            `${v.id} flagged AT RISK — secondary exposure through cascaded services`,
            "warn",
            "phase3_cascade",
            4000
          )
        );
      });
    } else {
      events.push(
        makeLog(
          `No cascade detected. No other service lost majority of its validators.`,
          "safe",
          "phase3_cascade",
          3600
        )
      );
    }

    const metrics = computeMetrics(validators, avsServices);
    steps.push({
      phase: "phase3_cascade",
      timestamp: 3600,
      events,
      validatorSnapshot: validators,
      avsSnapshot: avsServices,
      metrics,
    });
  }

  // ── Step 4: Final assessment ──────────────────────────────────────────────
  {
    const validators = cloneValidators(steps[steps.length - 1].validatorSnapshot);
    const avsServices = cloneAVS(steps[steps.length - 1].avsSnapshot);
    const metrics = computeMetrics(validators, avsServices);
    const recommendation = generateRecommendation(metrics, byzantineAvsId);

    const events: LogEntry[] = [
      makeLog(
        `Simulation complete. ${metrics.affectedValidators}/${metrics.totalValidators} validators affected.`,
        "info",
        "complete",
        5000
      ),
      makeLog(
        `Total stake slashed: ${metrics.totalSlashedStake.toLocaleString()} ETH`,
        metrics.totalSlashedStake > 0 ? "danger" : "safe",
        "complete",
        5200
      ),
      makeLog(
        `Estimated attacker profit: ~${metrics.attackerProfitEstimate.toLocaleString()} ETH`,
        metrics.attackerProfitEstimate > 0 ? "danger" : "safe",
        "complete",
        5400
      ),
      makeLog(
        `Network health: ${metrics.networkHealthPct}% | Risk score: ${metrics.riskScore}/100`,
        metrics.riskScore >= 60 ? "danger" : metrics.riskScore >= 30 ? "warn" : "safe",
        "complete",
        5600
      ),
    ];

    steps.push({
      phase: "complete",
      timestamp: 5000,
      events,
      validatorSnapshot: validators,
      avsSnapshot: avsServices,
      metrics,
    });

    return {
      steps,
      finalMetrics: metrics,
      recommendation,
      attackerProfit: metrics.attackerProfitEstimate,
    };
  }
}
