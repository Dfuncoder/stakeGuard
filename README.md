# ⬡ StakeGuard

**Restaking Attack Surface Visualizer** — a DeFi security tool that models Byzantine AVS failures, cascading slashing events, and correlated stake exposure across EigenLayer-style restaking networks.

> Built for DeFi security hackathons. Grounded in peer-reviewed research on Elastic Restaking Networks.

---

## The Problem

Restaking protocols like EigenLayer allow validators to secure multiple Actively Validated Services (AVSs) with the same stake. This is capital-efficient — but creates a hidden systemic risk:

**A single Byzantine (malicious or buggy) AVS can trigger cascading slashing across every validator that shared stake with it — weakening the security of every other service those validators secured.**

The academic proof (from *Elastic Restaking Networks*, Technion 2024) shows:
- Finding the most profitable attack across a restaking network is **NP-complete** in general
- Even one Byzantine service can slash shared stake and **degrade the entire ecosystem**
- Validators need decision-support tooling, not just theory

Yet today, **no operator tooling exists** to visualize or simulate these cascades before they happen.

StakeGuard fills that gap.

---

## What It Does

StakeGuard is a **live attack simulator** with three core capabilities:

### 1. Network Visualization
Renders a real-time graph of validators (outer ring) and AVS services (inner ring), with edges representing stake allocations. Hover any node to see stake, health, services, and status.

### 2. Byzantine Failure Injection
Select any AVS to mark as Byzantine. The simulator propagates:
- **Phase 1** — Flags exposed validators as at-risk
- **Phase 2** — Slashes 30% of stake from all allocated validators
- **Phase 3** — Detects cascade: identifies other services weakened by shared-validator slashing; flags secondary validators

### 3. Risk Scoring & Recommendations
After each simulation:
- Live 0–100 risk score with color-coded severity
- Per-metric breakdown (stake lost, cascade depth, affected validators, attacker profit estimate)
- Timestamped event log narrating each phase
- Actionable recommendation: specific allocation changes to reduce blast radius

---

## Architecture

```
stakeguard/
├── app/
│   ├── api/
│   │   └── simulate/
│   │       └── route.ts          # POST /api/simulate — pure simulation engine
│   ├── components/
│   │   ├── Header.tsx            # Top bar with logo and badges
│   │   ├── Dashboard.tsx         # Root layout orchestrator (client)
│   │   ├── LeftPanel.tsx         # Validator cards + AVS list + action buttons
│   │   ├── NetworkCanvas.tsx     # Canvas renderer — nodes, edges, tooltips
│   │   ├── Toolbar.tsx           # Run/Pause/Step controls + status indicator
│   │   ├── RightPanel.tsx        # Risk score, metrics, event log, recommendation
│   │   └── AttackModal.tsx       # AVS selection modal
│   ├── hooks/
│   │   ├── useSimulation.ts      # Central state machine + API integration
│   │   └── useCanvasSize.ts      # ResizeObserver for responsive canvas
│   ├── lib/
│   │   ├── data.ts               # Seed data: validators and AVS services
│   │   ├── simulation.ts         # Pure simulation engine (also used server-side)
│   │   ├── canvas.ts             # Layout and hit-testing utilities
│   │   └── utils.ts              # cn() helper
│   ├── types/
│   │   └── index.ts              # All shared TypeScript interfaces
│   ├── globals.css               # Tailwind base + custom scrollbar
│   ├── layout.tsx                # Root layout, fonts, metadata
│   └── page.tsx                  # Entry point → Dashboard
├── public/
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js 14 App Router** | API routes for server-side simulation engine, easy Vercel deploy |
| **TypeScript strict mode** | All domain types are explicit; no `any` in simulation logic |
| **Canvas 2D API** | No graph library dependency; full control over rendering and animation |
| **Simulation runs server-side** | `/api/simulate` is a pure function — easily unit-testable and swappable for a heavier solver |
| **ResizeObserver hook** | Canvas is fully responsive; layout recalculates on window resize |
| **Step-by-step playback** | Judges and operators can pause at each phase to understand what happened |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v3 |
| Rendering | Canvas 2D API |
| Fonts | Syne (display) + Space Mono (data) |
| Animation | CSS keyframes + Tailwind |
| API | Next.js Route Handlers |
| Deploy | Vercel (zero config) |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm / yarn / pnpm

### Install & Run

```bash
# 1. Clone the repo
git clone https://github.com/your-org/stakeguard.git
cd stakeguard

# 2. Install dependencies
npm install

# 3. Copy env file (no keys required for MVP)
cp .env.example .env.local

# 4. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
npx vercel --prod
```

No environment variables required for the MVP.

---

## How to Demo (Hackathon Walkthrough)

**Step 1 — Show the network**
The dashboard loads with 6 validators and 5 real AVS services (EigenDA, Lagrange, Omni Network, AltLayer, Witness Chain). Point out the allocation graph and mean restaking degree.

**Step 2 — Inject a high-connectivity attack**
Click **⚡ Inject Byzantine Failure** → select **EigenDA** (most validators). Press **▶ Run Simulation**.

Watch:
- Phase 1: V1, V2, V5 flagged at-risk (yellow)
- Phase 2: 30% slashed from each (red, health arcs shrink)
- Phase 3: Lagrange and AltLayer degraded via cascade; V3, V4 flagged secondary risk
- Risk score jumps to CRITICAL (60+)

**Step 3 — Compare with low-connectivity attack**
Click **↺ Reset** → attack **Witness Chain** (only V3, V6). Run again. Risk score stays LOW. This demonstrates the paper's core thesis: *degree matters*.

**Step 4 — Point to the recommendation**
The right panel outputs a specific allocation fix. This is what operators need.

---

## Simulation Model

The simulation engine (`app/lib/simulation.ts`) runs four phases:

```
Phase 0  — Target locked, initial metrics computed
Phase 1  — Byzantine AVS flagged; exposed validators marked at_risk
Phase 2  — Slashing: slash_pct × stake removed from each exposed validator
Phase 3  — Cascade: identify secondary services and validators weakened
Phase 4  — Final assessment: risk score, attacker profit, recommendation
```

### Risk Score Formula

```
riskScore = (affectedValidators / totalValidators) × 50
          + (totalSlashedStake / totalStake)       × 50
```

Capped at 99. Drives the color coding:
- `0–29` → NOMINAL (green)
- `30–59` → MEDIUM RISK (orange)
- `60–99` → CRITICAL (red)

### Attacker Profit Estimate

```
attackerProfit ≈ totalSlashedStake × 0.05
```

Conservative estimate based on secondary market impact of slashed ETH.

---

## Roadmap (Post-Hackathon)

### v0.2 — Custom Network Editor
- Drag-and-drop validator and AVS node creation
- Editable stake amounts and service allocations
- Export/import network topology as JSON

### v0.3 — On-Chain Data Integration
- Fetch real EigenLayer operator allocations via subgraph
- Live restaking degree monitoring with alerting
- Historical slash event replay

### v0.4 — MIP Solver Backend
- NP-hard attack search approximation (based on paper's MIP formulation)
- Optimal allocation recommendations using OR-Tools
- "Safe region" visualization for validator configurations

### v0.5 — Monitoring Mode
- Webhook alerts when restaking degree exceeds threshold
- Telegram/Discord bot integration
- Operator dashboard with persistent risk history

---

## Research Foundation

This tool is directly inspired by:

> **Elastic Restaking Networks** — Ertem Nusret Tas, Suryanarayana Sankagiri, David Tse, Zhuolun Xiang (Technion / Stanford, 2024)

Key insights applied:
1. Correlated validator exposure creates systemic, not isolated, risk (§3.2–3.4)
2. Attack profitability search is NP-complete — operators need approximation tooling (§4)
3. Elastic stake stretching after slashing weakens remaining security guarantees (§3)
4. Mean restaking degree is a practical proxy for network-wide robustness (§5)

---

## Contributing

Pull requests welcome. Please open an issue first to discuss major changes.

```bash
npm run type-check   # TypeScript validation
npm run lint         # ESLint
npm run build        # Production build check
```

---

## License

MIT © 2024 StakeGuard Contributors
