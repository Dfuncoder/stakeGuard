"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/app/lib/utils";
import type { LogEntry, NetworkMetrics } from "@/app/types";

interface Props {
  metrics: NetworkMetrics;
  log: LogEntry[];
  recommendation: string;
}

function RiskScore({ score }: { score: number }) {
  const level =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  const label =
    score >= 60
      ? "CRITICAL — Network Compromised"
      : score >= 30
      ? "MEDIUM RISK — Cascade Spreading"
      : "NOMINAL — No Active Threat";

  return (
    <div className="p-5 border-b border-border text-center">
      <div className="font-mono text-[9px] tracking-[2px] text-text-dim uppercase mb-3">
        Network Risk Score
      </div>
      <div
        className={cn(
          "font-mono font-bold leading-none transition-colors duration-500 text-[52px]",
          level === "high" && "text-danger",
          level === "medium" && "text-warn",
          level === "low" && "text-safe"
        )}
      >
        {String(score).padStart(2, "0")}
      </div>
      <div className="font-mono text-[10px] text-text-dim mt-1.5">{label}</div>
      <div className="mt-3 h-1.5 bg-border relative">
        <div
          className="h-1.5 transition-all duration-700"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, #00e676, #ff9800, #ff4444)`,
            backgroundSize: "100px 100%",
          }}
        />
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  variant?: "safe" | "warn" | "danger" | "default";
}

function MetricRow({ label, value, variant = "default" }: MetricRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-2.5 border-b border-border",
        variant === "danger" && "bg-danger/5"
      )}
    >
      <span className="text-[12px] text-text-dim">{label}</span>
      <span
        className={cn(
          "font-mono text-[12px] font-bold transition-colors duration-300",
          variant === "safe" && "text-safe",
          variant === "warn" && "text-warn",
          variant === "danger" && "text-danger",
          variant === "default" && "text-text"
        )}
      >
        {value}
      </span>
    </div>
  );
}

const LEVEL_STYLES: Record<LogEntry["level"], string> = {
  danger: "border-danger text-[#ff8080]",
  warn: "border-warn text-[#ffb74d]",
  info: "border-accent text-[#ffd54f]",
  safe: "border-safe text-[#69f0ae]",
  neutral: "border-border text-text-dim",
};

function LogLine({ entry, startTs }: { entry: LogEntry; startTs: number }) {
  const elapsed = Math.max(0, entry.timestamp - startTs);
  const mm = String(Math.floor(elapsed / 60000)).padStart(2, "0");
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");

  return (
    <div
      className={cn(
        "font-mono text-[10px] px-2 py-1.5 mb-1 border-l-2 leading-relaxed animate-slide-in",
        LEVEL_STYLES[entry.level]
      )}
    >
      <span className="text-muted mr-1.5">{mm}:{ss}</span>
      {entry.message}
    </div>
  );
}

export default function RightPanel({ metrics, log, recommendation }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const startTs = log[0]?.timestamp ?? 0;

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  return (
    <div className="border-l border-border flex flex-col overflow-hidden">
      <RiskScore score={metrics.riskScore} />

      <MetricRow
        label="Total Stake At Risk"
        value={metrics.totalSlashedStake > 0 ? `${metrics.totalSlashedStake.toLocaleString()} ETH` : "0 ETH"}
        variant={metrics.totalSlashedStake > 2000 ? "danger" : metrics.totalSlashedStake > 0 ? "warn" : "default"}
      />
      <MetricRow
        label="Cascade Depth"
        value={String(metrics.cascadeDepth)}
        variant={metrics.cascadeDepth >= 3 ? "danger" : metrics.cascadeDepth > 0 ? "warn" : "default"}
      />
      <MetricRow
        label="Affected Validators"
        value={`${metrics.affectedValidators} / ${metrics.totalValidators}`}
        variant={
          metrics.affectedValidators >= 4
            ? "danger"
            : metrics.affectedValidators > 0
            ? "warn"
            : "default"
        }
      />
      <MetricRow
        label="Attacker Profit Est."
        value={metrics.attackerProfitEstimate > 0 ? `~${metrics.attackerProfitEstimate.toLocaleString()} ETH` : "—"}
        variant={metrics.attackerProfitEstimate > 0 ? "danger" : "default"}
      />
      <MetricRow
        label="Mean Restaking Degree"
        value={String(metrics.meanRestakingDegree)}
        variant={metrics.meanRestakingDegree >= 3 ? "warn" : "default"}
      />
      <MetricRow
        label="Network Health"
        value={`${metrics.networkHealthPct}%`}
        variant={metrics.networkHealthPct < 50 ? "danger" : metrics.networkHealthPct < 80 ? "warn" : "safe"}
      />

      <div className="flex items-center gap-2 px-5 py-3 border-b border-border font-mono text-[10px] tracking-[2px] text-text-dim uppercase flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        Event Log
      </div>

      <div ref={logRef} className="overflow-y-auto p-3" style={{ height: "160px", minHeight: "160px", maxHeight: "160px" }}>
        {log.map((entry) => (
          <LogLine key={entry.id} entry={entry} startTs={startTs} />
        ))}
      </div>

      {/* Recommendation box — always visible, never hidden */}
      <div
        className="flex-shrink-0 border-t-2 border-accent"
        style={{ background: "rgba(240,165,0,0.10)" }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-accent/30"
          style={{ background: "rgba(240,165,0,0.15)" }}
        >
          <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
          <span className="font-mono text-[10px] tracking-[2px] text-accent uppercase font-bold">
            Risk Recommendation
          </span>
        </div>

        {/* Recommendation text */}
        <div className="px-4 py-3">
          <p
            className="text-[12px] leading-relaxed font-sans"
            style={{ color: "#e2e8f0" }}
          >
            {recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
