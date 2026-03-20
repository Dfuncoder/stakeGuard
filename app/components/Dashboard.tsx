"use client";

import { useState } from "react";
import { useSimulation } from "@/app/hooks/useSimulation";
import { useCanvasSize } from "@/app/hooks/useCanvasSize";
import Header from "@/app/components/Header";
import LeftPanel from "@/app/components/LeftPanel";
import Toolbar from "@/app/components/Toolbar";
import NetworkCanvas from "@/app/components/NetworkCanvas";
import RightPanel from "@/app/components/RightPanel";
import AttackModal from "@/app/components/AttackModal";

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { containerRef, width, height } = useCanvasSize();

  const sim = useSimulation(width, height);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg text-text">
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(240,165,0,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(240,165,0,0.015) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <Header />

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Left panel — fixed width */}
        <div className="w-[300px] flex-shrink-0 overflow-hidden flex flex-col">
          <LeftPanel
            validators={sim.validators}
            avsServices={sim.avsServices}
            byzantineAvsId={sim.byzantineAvsId}
            onInjectClick={() => setModalOpen(true)}
            onReset={sim.reset}
          />
        </div>

        {/* Centre — canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Toolbar
            phase={sim.phase}
            isRunning={sim.isRunning}
            byzantineAvsId={sim.byzantineAvsId}
            stepIndex={sim.stepIndex}
            totalSteps={sim.totalSteps}
            onRun={sim.runSimulation}
            onStep={sim.stepForward}
          />
          <div ref={containerRef} className="flex-1 relative overflow-hidden">
            <NetworkCanvas
              validators={sim.validators}
              avsServices={sim.avsServices}
              width={width}
              height={height}
            />
          </div>
        </div>

        {/* Right panel — fixed width */}
        <div className="w-[280px] flex-shrink-0 overflow-hidden flex flex-col">
          <RightPanel
            metrics={sim.metrics}
            log={sim.log}
            recommendation={sim.recommendation}
          />
        </div>
      </div>

      {modalOpen && (
        <AttackModal
          avsServices={sim.avsServices}
          onSelect={(id) => { sim.lockTarget(id); setModalOpen(false); }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
