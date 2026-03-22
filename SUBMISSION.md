# StakeGuard — Hackathon Submission

**Track:** DeFi, Security & Mechanism Design (IC3)
**Sub-track:** Elastic Restaking Networks
**Team:** [Your Name / Team Name]
**Demo URL:** [your-vercel-url.vercel.app]
**Contract (Sepolia):** [0x...]

---

## One-Line Pitch

StakeGuard is an on-chain restaking risk registry and attack surface visualizer that detects Byzantine AVS failures, executes elastic slashing, and warns operators before cascading losses destroy the network.

---

## The Problem

EigenLayer and Symbiotic let validators secure multiple Actively Validated Services (AVSs) with the same stake. This is capital-efficient — but creates a hidden systemic risk the paper calls **correlated exposure**:

> A single Byzantine (malicious or buggy) AVS can trigger slashing across every validator that secured it. Those validators also secured other services. Those services now lose their validators too. One failure cascades into a network-wide collapse.

**This is not theoretical.** The *Elastic Restaking Networks* paper (Technion, 2024) proves:
- Finding the most profitable attack is **NP-complete**
- One Byzantine service can degrade the **entire ecosystem**
- Validators currently make allocation decisions **completely blind** to systemic risk

**No tooling exists today** to make this risk visible or enforceable.

---

## The Solution

StakeGuard has two layers:

### Layer 1 — On-Chain: `RestakingGuard.sol`

A Solidity contract deployed on Sepolia that:

1. **Maintains a live registry** of validators, AVS services, and stake allocations
2. **Detects Byzantine failures** via `reportByzantine(avsId)` — in production, this would be triggered by a fraud proof or quorum vote
3. **Executes elastic slashing** via `executeSlashing(avsId, slashBps)` — proportional slash across all exposed validators, bounded by a circuit breaker (max 50%)
4. **Runs cascade detection** automatically — if ≥50% of any service's validators are slashed, emits `CascadeRiskDetected` on-chain
5. **Publishes a live risk score** (0–99) computed identically to the off-chain simulation, so frontend and contract always agree

Key events emitted:
```
ValidatorSlashed(validatorId, byzantineAvsId, amount, remaining, timestamp)
CascadeRiskDetected(secondaryAvsId, slashedCount, totalCount, riskBps, timestamp)
RiskScoreUpdated(score, totalSlashed, totalStake, timestamp)
```

### Layer 2 — Off-Chain: Next.js Dashboard

A real-time attack surface visualizer that:

1. **Renders the restaking network** as a live graph — validators (outer ring), AVS services (inner ring), allocation edges
2. **Simulates any Byzantine attack** step-by-step with a 4-phase engine matching the contract logic exactly
3. **Shows cascading damage** propagating across the network with color-coded severity
4. **Outputs a risk score and recommendation** — specific allocation changes to reduce blast radius
5. **Reads live contract state** — when deployed, shows real on-chain risk score with a "LIVE" badge

---

## Architecture

```
stakeguard/
├── app/                          # Next.js 14 (App Router) frontend
│   ├── api/simulate/route.ts     # REST API — runs simulation engine server-side
│   ├── components/               # Dashboard, Canvas, Panels, Modal, Toolbar
│   ├── hooks/
│   │   ├── useSimulation.ts      # Central state machine
│   │   ├── useContractState.ts   # Live on-chain polling (optional)
│   │   └── useCanvasSize.ts      # Responsive canvas
│   ├── lib/
│   │   ├── simulation.ts         # Pure simulation engine (mirrors contract logic)
│   │   └── data.ts               # Seed network — 6 validators, 5 AVS services
│   └── types/index.ts            # All TypeScript interfaces
│
└── contracts/                    # Hardhat workspace
    ├── contracts/
    │   ├── RestakingGuard.sol    # Main contract (270 lines)
    │   └── IRestakingGuard.sol   # Interface
    ├── test/
    │   └── RestakingGuard.test.ts # 36 tests across 10 suites
    └── scripts/
        └── deploy.ts             # Seeds network + exports addresses to frontend
```

---

## Technical Highlights

### The Cascade Algorithm (on-chain and off-chain identical)

```solidity
// A service degrades only if ≥50% of its validators are slashed
uint256 riskBps = (slashedCount * 10_000) / totalCount;
if (riskBps >= CASCADE_THRESHOLD_BPS) {  // 5000 = 50%
    emit CascadeRiskDetected(secondaryAvsId, slashedCount, totalCount, riskBps, block.timestamp);
}
```

### The Risk Score Formula

```
riskScore = (totalSlashedStake / totalNetworkStake) × 55    // stake damage
           + (cascadedServices / otherServices)       × 45    // cascade breadth
```

This formula is computed identically in `RestakingGuard.sol` and `simulation.ts` — so the frontend simulation and the live contract always produce the same number.

### Meaningful Risk Differentiation

| AVS Attacked | Risk Score | Cascade |
|---|---|---|
| EigenDA (AVS-A) | 45 / 100 | 3 services degraded |
| Lagrange (AVS-B) | 44 / 100 | 3 services degraded |
| AltLayer (AVS-D) | 31 / 100 | 2 services degraded |
| Omni Network (AVS-C) | 20 / 100 | 1 service degraded |
| **Witness Chain (AVS-E)** | **5 / 100** | **0 cascade** |

This demonstrates the paper's core thesis — **restaking degree determines blast radius**.

---

## Research Connection

This project is a direct implementation of insights from:

> **Elastic Restaking Networks** — Ertem Nusret Tas, Suryanarayana Sankagiri, David Tse, Zhuolun Xiang (Technion / Stanford, 2024)

| Paper Insight | Implementation |
|---|---|
| Byzantine AVS triggers cross-service slashing (§3.2) | `executeSlashing()` + cascade detection |
| Security threshold per service (§3.3) | 50% cascade trigger (`CASCADE_THRESHOLD_BPS`) |
| Elastic stake stretching after losses (§3.4) | `slashedStake` tracked separately from `totalStake`, health arc on canvas |
| Attack profitability ≈ 5% of slashed stake (§4) | `attackerProfitEstimate = totalSlashed × 0.05` |
| Mean restaking degree as robustness proxy (§5) | Displayed as live metric; used in recommendations |
| NP-hard attack search → need approximation tools (§4) | This tool is that approximation |

---

## Demo Walkthrough (2 minutes)

**Step 1** — Open the dashboard. Point out the network: 6 validators, 5 AVS services, allocation graph, mean restaking degree = 2.3.

**Step 2** — Click **⚡ Inject Byzantine Failure** → select **EigenDA (AVS-A)** → press **▶ Run Simulation**.

Watch:
- Phase 1: V1, V2, V5 flagged at-risk (yellow)
- Phase 2: 30% slashed — V1 loses 1,440 ETH, V2 loses 960 ETH, V5 loses 1,080 ETH
- Phase 3: Lagrange, AltLayer, Witness Chain cascade — 3 more services degraded
- Risk score → 45/100 MEDIUM, event log narrates every step

**Step 3** — Click **↺ Reset** → attack **Witness Chain (AVS-E)**.

Watch: only V5 and V6 affected, zero cascade, risk score → 5/100 LOW.

**Step 4** — Point to the recommendation: *"Review shared allocations on validators with degree ≥3."*

**Step 5** *(if contract deployed)* — Show the Sepolia Etherscan page. Point to the `CascadeRiskDetected` event. This is the same cascade the dashboard just showed — now permanently recorded on-chain.

---

## What's Next (Roadmap)

| Version | Feature |
|---|---|
| v0.2 | Custom network editor — drag-and-drop topology |
| v0.3 | Live EigenLayer data via subgraph — real validators, real allocations |
| v0.4 | MIP solver backend — finds the optimal attack for any network (from paper §4) |
| v0.5 | Monitoring mode — webhook alerts when risk score exceeds threshold |
| v1.0 | Integration with EigenLayer's AVS registry contract |

---

## Running Locally

```bash
# 1. Clone and install
unzip stakeguard.zip && cd stakeguard
npm install          # frontend deps
cd contracts && npm install && cd ..

# 2. Start frontend (simulation mode — no contract needed)
npm run dev
# → http://localhost:3000

# 3. Optional: run with live contract
npm run contracts:node          # terminal 1 — local hardhat blockchain
npm run contracts:deploy:local  # terminal 2 — deploy + seed network
# Set in .env.local:
# NEXT_PUBLIC_CONTRACT_ADDRESS=<address from deploy output>
# NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
npm run dev                     # now shows LIVE badge

# 4. Run contract tests (36 tests)
npm run contracts:test
```

---

*Built for the IC3 DeFi, Security & Mechanism Design Hackathon track.*
*Grounded in peer-reviewed research. MIT License.*
