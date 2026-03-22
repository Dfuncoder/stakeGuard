"use client";

import { cn } from "@/app/lib/utils";

interface Props {
  recommendation: string;
  riskScore: number;
}

export default function RecommendationBar({ recommendation, riskScore }: Props) {
  const level = riskScore >= 60 ? "critical" : riskScore >= 30 ? "warn" : "safe";

  const borderColor =
    level === "critical" ? "#ff4444" : level === "warn" ? "#ff9800" : "#f0a500";

  const bgColor =
    level === "critical"
      ? "rgba(255,68,68,0.08)"
      : level === "warn"
      ? "rgba(255,152,0,0.08)"
      : "rgba(240,165,0,0.08)";

  const dotColor =
    level === "critical" ? "bg-danger" : level === "warn" ? "bg-warn" : "bg-accent";

  const labelColor =
    level === "critical" ? "text-danger" : level === "warn" ? "text-warn" : "text-accent";

  return (
    <div
      className="flex-shrink-0 flex items-stretch border-t-2"
      style={{ borderColor, background: bgColor, minHeight: "52px" }}
    >
      {/* Left label */}
      <div
        className="flex items-center gap-2 px-4 border-r flex-shrink-0"
        style={{ borderColor: `${borderColor}40` }}
      >
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
        <span
          className={cn(
            "font-mono text-[10px] tracking-[2px] uppercase font-bold whitespace-nowrap",
            labelColor
          )}
        >
          ⬡ Risk Recommendation
        </span>
      </div>

      {/* Recommendation text */}
      <div className="flex items-center px-5 py-2 flex-1">
        <p className="text-[12px] leading-relaxed" style={{ color: "#e2e8f0" }}>
          {recommendation}
        </p>
      </div>
    </div>
  );
}
