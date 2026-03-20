"use client";

import { cn } from "@/app/lib/utils";
import type { AVSService, Validator } from "@/app/types";

interface Props {
  validators: Validator[];
  avsServices: AVSService[];
  byzantineAvsId: string | null;
  onInjectClick: () => void;
  onReset: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] tracking-[2px] text-text-dim uppercase mb-2 mt-5 first:mt-0">
      {children}
    </div>
  );
}

function ValidatorCard({ v }: { v: Validator }) {
  const pct = Math.max(
    0,
    Math.round(((v.stake - v.slashedStake) / v.stake) * 100)
  );
  return (
    <div
      className={cn(
        "bg-surface2 border p-3 mb-2 transition-all duration-200",
        v.status === "slashed" && "border-danger opacity-60",
        v.status === "at_risk" && "border-warn",
        v.status === "normal" && "border-border"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold text-[13px]" style={{ color: v.color }}>
          {v.id}
        </span>
        <span className="font-mono text-[11px] text-accent">
          {(v.stake - v.slashedStake).toLocaleString()} ETH
        </span>
      </div>
      <div className="h-1 bg-border mb-2">
        <div
          className="h-1 transition-all duration-700"
          style={{
            width: `${pct}%`,
            background:
              v.status === "slashed"
                ? "#ff4444"
                : v.status === "at_risk"
                ? "#ff9800"
                : v.color,
          }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {v.services.map((sId) => (
          <span
            key={sId}
            className={cn(
              "font-mono text-[9px] px-1.5 py-0.5 border transition-all",
              "border-border text-text-dim"
            )}
          >
            {sId}
          </span>
        ))}
      </div>
    </div>
  );
}

function AVSItem({ avs }: { avs: AVSService }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2.5 bg-surface2 border mb-1.5 transition-all",
        avs.status === "byzantine" && "border-danger bg-danger/5",
        avs.status === "at_risk" && "border-warn bg-warn/5",
        avs.status === "normal" && "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0 transition-all",
            avs.status === "byzantine" && "bg-danger animate-blink",
            avs.status === "at_risk" && "bg-warn",
            avs.status === "normal" && ""
          )}
          style={{
            background:
              avs.status === "normal" ? avs.color : undefined,
          }}
        />
        <div>
          <div className="font-bold text-[12px]">{avs.name}</div>
          <div className="font-mono text-[10px] text-text-dim">
            {avs.tvl.toLocaleString()} ETH TVL
          </div>
        </div>
      </div>
      <div className="font-mono text-[10px] text-accent">{avs.rewardAPY}%</div>
    </div>
  );
}

export default function LeftPanel({
  validators,
  avsServices,
  onInjectClick,
  onReset,
}: Props) {
  return (
    <div className="border-r border-border flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border font-mono text-[10px] tracking-[2px] text-text-dim uppercase">
        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
        Network Configuration
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        <SectionLabel>Validators ({validators.length})</SectionLabel>
        {validators.map((v) => (
          <ValidatorCard key={v.id} v={v} />
        ))}

        <SectionLabel>AVS Services ({avsServices.length})</SectionLabel>
        {avsServices.map((a) => (
          <AVSItem key={a.id} avs={a} />
        ))}

        <SectionLabel>Actions</SectionLabel>
        <button
          onClick={onInjectClick}
          className="w-full mb-2 font-mono text-[11px] px-4 py-2 border border-danger text-danger hover:bg-danger hover:text-white transition-all tracking-widest uppercase"
        >
          ⚡ Inject Byzantine Failure
        </button>
        <button
          onClick={onReset}
          className="w-full font-mono text-[11px] px-4 py-2 border border-border text-text-dim hover:border-text hover:text-text transition-all tracking-widest uppercase"
        >
          ↺ Reset Network
        </button>
      </div>
    </div>
  );
}
