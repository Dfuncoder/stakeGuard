# ⬡ StakeGuard

**Restaking Attack Surface Visualizer** — an on-chain risk registry and simulation dashboard that detects Byzantine AVS failures, executes elastic slashing, and warns operators before cascading losses destroy a restaking network.

> Built for the IC3 DeFi, Security & Mechanism Design Hackathon.
> Directly implements insights from *Elastic Restaking Networks* (Technion / Stanford, 2024).

---

## The Problem

EigenLayer and Symbiotic let validators secure multiple AVS services with the same stake. This is capital-efficient — but one Byzantine service can cascade slashing across every validator that shared stake with it, weakening every other service those validators secured.

**No tooling exists** to make this risk observable or enforceable. StakeGuard fixes that.

---

## What It Does

### On-Chain — `RestakingGuard.sol`
- Maintains a live registry of validators, AVS services, and stake allocations
- Flags Byzantine services and executes proportional elastic slashing
- Automatically detects cascade risk (≥50% threshold) and emits `CascadeRiskDetected`
- Publishes a live risk score (0–99) on-chain after every slash incident

### Off-Chain — Next.js Dashboard
- Renders the restaking network as a live graph
- Simulates any Byzantine attack step-by-step with a 4-phase engine
- Reads live contract state when deployed (shows LIVE badge)
- Outputs risk score, event log, and allocation recommendations

---

## Project Structure

```
stakeguard/
├── app/                              # Next.js 14 (App Router) — TypeScript
│   ├── api/simulate/route.ts         # POST /api/simulate — server-side engine
│   ├── components/
│   │   ├── Dashboard.tsx             # Root layout orchestrator
│   │   ├── NetworkCanvas.tsx         # Canvas 2D graph renderer
│   │   ├── LeftPanel.tsx             # Validator cards + AVS list
│   │   ├── RightPanel.tsx            # Risk score, metrics, event log
│   │   ├── Toolbar.tsx               # Run / Pause / Step controls
│   │   ├── AttackModal.tsx           # Byzantine AVS selector
│   │   └── Header.tsx                # Logo + live chain badge
│   ├── hooks/
│   │   ├── useSimulation.ts          # Central state machine
│   │   ├── useContractState.ts       # Live on-chain polling
│   │   └── useCanvasSize.ts          # Responsive canvas
│   ├── lib/
│   │   ├── simulation.ts             # Pure simulation engine
│   │   ├── data.ts                   # Seed network data
│   │   ├── canvas.ts                 # Layout + hit-test utilities
│   │   └── utils.ts                  # cn() helper
│   └── types/index.ts                # All TypeScript types
│
└── contracts/                        # Hardhat — TypeScript
    ├── contracts/
    │   ├── RestakingGuard.sol        # Main contract (270 lines)
    │   └── IRestakingGuard.sol       # Interface
    ├── test/
    │   └── RestakingGuard.test.ts    # 36 tests, 10 suites
    └── scripts/
        └── deploy.ts                 # Seeds network + writes app/lib/contract.ts
```

---

## Quick Start

```bash
unzip stakeguard.zip && cd stakeguard

# Frontend (simulation mode — no contract needed)
npm install
npm run dev
# Open http://localhost:3000

# Contracts
cd contracts && npm install
npx hardhat test          # run 36 tests
npx hardhat node          # start local blockchain
npm run deploy:local      # deploy + seed network
```

### Enable Live Chain Mode

After deploying, add to `.env.local`:
```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourAddress
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```
Restart `npm run dev` — the header will show a green LIVE badge.

### Deploy to Sepolia

```bash
cd contracts
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY
npm run deploy:sepolia
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript 5, Tailwind CSS |
| Rendering | Canvas 2D API |
| Smart Contracts | Solidity 0.8.24 |
| Contract Tooling | Hardhat, ethers v6, TypeChain |
| Testing | Mocha, Chai, Hardhat Network Helpers |
| Fonts | Syne + Space Mono |
| Deploy | Vercel (frontend) + Sepolia (contracts) |

---

## Contract Events Reference

```solidity
// Emitted for each validator slashed in an incident
ValidatorSlashed(validatorId, byzantineAvsId, slashedAmount, remaining, timestamp)

// Emitted when a secondary service loses ≥50% of its validators
CascadeRiskDetected(secondaryAvsId, slashedCount, totalCount, riskBps, timestamp)

// Emitted after every slash — updated risk score
RiskScoreUpdated(newScore, totalSlashedStake, totalNetworkStake, timestamp)
```

---

## Research Foundation

> **Elastic Restaking Networks** — Tas, Sankagiri, Tse, Xiang (Technion / Stanford, 2024)

| Paper Insight | Where Implemented |
|---|---|
| Byzantine AVS cascades slashing (§3.2) | `executeSlashing()` → cascade loop |
| Security threshold per service (§3.3) | `CASCADE_THRESHOLD_BPS = 5000` (50%) |
| Elastic stake stretching (§3.4) | `slashedStake` tracked separately; health arc on canvas |
| Attack profitability estimation (§4) | `attackerProfitEstimate = slashed × 0.05` |
| Restaking degree as robustness proxy (§5) | Live metric; drives recommendations |

---

## License

MIT © 2024 StakeGuard Contributors
