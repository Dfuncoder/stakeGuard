"use client";

import { useEffect } from "react";
import { cn } from "@/app/lib/utils";
import type { AVSService } from "@/app/types";

interface Props {
  avsServices: AVSService[];
  onSelect: (avsId: string) => void;
  onClose: () => void;
}

export default function AttackModal({ avsServices, onSelect, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const available = avsServices.filter((a) => a.status === "normal");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border p-8 w-full max-w-md animate-fade-up">
        <div className="text-[20px] font-bold mb-2">⚡ Inject Byzantine Failure</div>
        <p className="text-[12px] text-text-dim leading-relaxed mb-6">
          Select an AVS service to mark as Byzantine. The simulator will propagate
          slashing events across all validators allocated to that service and model
          cascading failures through the network.
        </p>

        {available.length === 0 ? (
          <p className="font-mono text-[12px] text-danger text-center py-4">
            All services are already compromised. Reset the network first.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {available.map((avs) => {
              const validatorCount = 0; // passed from parent ideally, showing TVL instead
              return (
                <button
                  key={avs.id}
                  onClick={() => { onSelect(avs.id); onClose(); }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 bg-surface2 border border-border",
                    "text-left transition-all hover:border-danger hover:text-danger group"
                  )}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:bg-danger transition-colors"
                    style={{ background: avs.color }}
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[13px]">{avs.name}</div>
                    <div className="font-mono text-[10px] text-text-dim group-hover:text-danger/70">
                      {avs.tvl.toLocaleString()} ETH TVL · {avs.rewardAPY}% APY
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-text-dim group-hover:text-danger">
                    {avs.id}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 font-mono text-[11px] px-4 py-2 border border-border text-text-dim hover:border-text hover:text-text transition-all tracking-widest uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
