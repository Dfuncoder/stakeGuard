"use client";

export default function Header() {
  return (
    <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border bg-bg/90 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hexagon logo */}
        <div
          className="w-9 h-9 bg-accent flex items-center justify-center text-bg font-bold text-base animate-[pulse-hex_3s_ease-in-out_infinite]"
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
