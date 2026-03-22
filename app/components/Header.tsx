"use client";

interface Props {
  isLiveChain?: boolean;
  contractAddress?: string;
}

export default function Header({ isLiveChain, contractAddress }: Props) {
  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border bg-bg/90 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hexagon logo */}
        <div
          className="w-9 h-9 bg-accent flex items-center justify-center text-bg font-bold text-base"
          style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
        >
          ⬡
        </div>
        <div>
          <div className="font-sans font-extrabold text-[20px] tracking-tight">
            Stake<span className="text-accent">Guard</span>
          </div>
          <div className="font-mono text-[9px] tracking-[2px] text-text-dim uppercase">
            Restaking Attack Surface Visualizer
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live chain indicator */}
        {isLiveChain && contractAddress && (
          <div className="flex items-center gap-2 font-mono text-[10px] text-safe border border-safe px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-safe animate-blink" />
            LIVE · {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)}
          </div>
        )}

        {!isLiveChain && (
          <div className="font-mono text-[10px] text-text-dim border border-border px-3 py-1.5">
            SIMULATION MODE
          </div>
        )}

        <a
          href="https://github.com/your-org/stakeguard"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] tracking-[2px] text-text-dim uppercase hover:text-accent transition-colors"
        >
          GitHub
        </a>
        <div className="font-mono text-[10px] px-3 py-1.5 border border-accent text-accent tracking-[2px] uppercase">
          Hackathon MVP v0.1
        </div>
      </div>
    </header>
  );
}
