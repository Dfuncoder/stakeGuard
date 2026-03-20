"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AVSService, Validator } from "@/app/types";
import { hitTestNode } from "@/app/lib/canvas";

interface TooltipData {
  x: number;
  y: number;
  content: string[];
}

interface Props {
  validators: Validator[];
  avsServices: AVSService[];
  width: number;
  height: number;
}

function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export default function NetworkCanvas({
  validators,
  avsServices,
  width,
  height,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // Background radial glow
    const cx = width / 2, cy = height / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, height * 0.45);
    grad.addColorStop(0, "rgba(240,165,0,0.04)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // ── Edges ──────────────────────────────────────────────────────────────
    validators.forEach((v) => {
      v.services.forEach((sId) => {
        const avs = avsServices.find((a) => a.id === sId);
        if (!avs) return;

        let color = "rgba(33,38,45,0.7)";
        let lw = 1;
        let dashed = false;

        if (avs.status === "byzantine") {
          color = v.status === "slashed"
            ? "rgba(255,68,68,0.75)"
            : "rgba(255,68,68,0.25)";
          lw = v.status === "slashed" ? 2 : 1.5;
          dashed = v.status !== "slashed";
        } else if (avs.status === "at_risk" || v.status === "at_risk") {
          color = "rgba(255,152,0,0.4)";
          lw = 1.5;
        }

        ctx.save();
        ctx.beginPath();
        if (dashed) ctx.setLineDash([4, 4]);
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(avs.x, avs.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      });
    });

    // ── AVS Nodes (hex) ────────────────────────────────────────────────────
    avsServices.forEach((avs) => {
      const r = 28;
      ctx.save();

      if (avs.status === "byzantine") {
        ctx.shadowColor = "#ff4444";
        ctx.shadowBlur = 22;
      } else if (avs.status === "at_risk") {
        ctx.shadowColor = "#ff9800";
        ctx.shadowBlur = 12;
      }

      drawHexagon(ctx, avs.x, avs.y, r);
      ctx.fillStyle =
        avs.status === "byzantine"
          ? "rgba(255,68,68,0.12)"
          : avs.status === "at_risk"
          ? "rgba(255,152,0,0.08)"
          : "rgba(13,17,23,0.9)";
      ctx.fill();
      ctx.strokeStyle =
        avs.status === "byzantine"
          ? "#ff4444"
          : avs.status === "at_risk"
          ? "#ff9800"
          : avs.color;
      ctx.lineWidth = avs.status !== "normal" ? 2.5 : 1.5;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle =
        avs.status === "byzantine"
          ? "#ff4444"
          : avs.status === "at_risk"
          ? "#ff9800"
          : avs.color;
      ctx.font = 'bold 10px "Space Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(avs.id, avs.x, avs.y);

      ctx.fillStyle = "rgba(180,180,180,0.55)";
      ctx.font = '9px "Syne", sans-serif';
      ctx.fillText(avs.name, avs.x, avs.y + r + 13);
      ctx.restore();
    });

    // ── Validator Nodes (circle) ───────────────────────────────────────────
    validators.forEach((v) => {
      const r = 22;
      const healthPct = Math.max(0, (v.stake - v.slashedStake) / v.stake);
      ctx.save();

      if (v.status === "slashed") {
        ctx.shadowColor = "#ff4444";
        ctx.shadowBlur = 16;
      } else if (v.status === "at_risk") {
        ctx.shadowColor = "#ff9800";
        ctx.shadowBlur = 10;
      }

      ctx.beginPath();
      ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
      ctx.fillStyle =
        v.status === "slashed"
          ? "rgba(255,68,68,0.12)"
          : v.status === "at_risk"
          ? "rgba(255,152,0,0.08)"
          : "rgba(13,17,23,0.9)";
      ctx.fill();
      ctx.strokeStyle =
        v.status === "slashed"
          ? "#ff4444"
          : v.status === "at_risk"
          ? "#ff9800"
          : v.color;
      ctx.lineWidth = v.status !== "normal" ? 2 : 1.5;
      ctx.stroke();

      // Health arc
      if (v.slashedStake > 0) {
        ctx.beginPath();
        ctx.arc(
          v.x, v.y,
          r - 5,
          -Math.PI / 2,
          -Math.PI / 2 + healthPct * Math.PI * 2
        );
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle =
        v.status === "slashed"
          ? "#ff8080"
          : v.status === "at_risk"
          ? "#ffb74d"
          : v.color;
      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(v.id, v.x, v.y - 3);

      ctx.fillStyle = "rgba(180,180,180,0.55)";
      ctx.font = '8px "Space Mono", monospace';
      ctx.fillText(
        (v.stake - v.slashedStake).toLocaleString() + "E",
        v.x,
        v.y + 9
      );

      ctx.restore();
    });

    // Centre label
    ctx.font = '10px "Space Mono", monospace';
    ctx.fillStyle = "rgba(240,165,0,0.35)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("RESTAKING", cx, cy - 8);
    ctx.fillText("NETWORK", cx, cy + 8);
  }, [validators, avsServices, width, height]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const vId = hitTestNode(mx, my, validators, 26);
      if (vId) {
        const v = validators.find((n) => n.id === vId)!;
        const health = Math.round(((v.stake - v.slashedStake) / v.stake) * 100);
        setTooltip({
          x: e.clientX + 14,
          y: e.clientY - 10,
          content: [
            v.name,
            `Stake: ${v.stake.toLocaleString()} ETH`,
            `Health: ${health}%`,
            `Services: ${v.services.join(", ")}`,
            `Status: ${v.status}`,
          ],
        });
        return;
      }

      const aId = hitTestNode(mx, my, avsServices, 32);
      if (aId) {
        const a = avsServices.find((n) => n.id === aId)!;
        const vCount = validators.filter((v) => v.services.includes(aId)).length;
        setTooltip({
          x: e.clientX + 14,
          y: e.clientY - 10,
          content: [
            a.name,
            `TVL: ${a.tvl.toLocaleString()} ETH`,
            `APY: ${a.rewardAPY}%`,
            `Validators: ${vCount}`,
            `Status: ${a.status}`,
          ],
        });
        return;
      }

      setTooltip(null);
    },
    [validators, avsServices]
  );

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="fixed z-50 bg-surface2 border border-border px-3 py-2 font-mono text-[11px] leading-relaxed pointer-events-none max-w-[200px]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content.map((line, i) => (
            <div key={i} className={i === 0 ? "font-bold text-accent mb-1" : "text-text-dim"}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
