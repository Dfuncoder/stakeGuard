# ⬡ StakeGuard

**On-chain restaking risk registry and attack surface visualizer.**

Detects Byzantine AVS failures, executes elastic slashing, propagates cascade detection, and publishes a live risk score on-chain. Built for the IC3 DeFi, Security & Mechanism Design Hackathon — Elastic Restaking track.

> Implements *Elastic Restaking Networks* (Tas, Sankagiri, Tse, Xiang — Technion / Stanford, 2024)

**Live Demo:** https://stake-guard.vercel.app
**Contract (Sepolia):** `0xdFC60484EEa7f91ebeC689fDA8C15c137a492c2a`

---

## Architecture

```
stakeguard/
├── app/                              # Next.js 14 — TypeScript
│   ├── api/
│   │   ├── simulate/route.ts         # POST /api/simulate — simulation engine
│   │   └── chain-state/route.ts      # GET /api/chain-state — reads live contract
│   ├── components/
│   │   ├── Dashboard.tsx             # Root layout
│   │   ├── NetworkCanvas.tsx         # Canvas 2D graph renderer
│   │   ├── LeftPanel.tsx             # Validator + AVS list
│   │   ├── RightPanel.tsx            # Risk score, metrics, event log
│   │   ├── Toolbar.tsx               # Simulation controls
│   │   ├── AttackModal.tsx           # Byzantine AVS selector
│   │   └── Header.tsx                # Logo + live chain badge
│   ├── hooks/
│   │   ├── useSimulation.ts          # Simulation state machine
│   │   ├── useContractState.ts       # Live contract polling
│   │   └── useCanvasSize.ts          # Responsive canvas
│   ├── lib/
│   │   ├── simulation.ts             # Pure simulation engine
│   │   ├── data.ts                   # Seed network — 6 validators, 5 AVS
│   │   ├── canvas.ts                 # Layout + hit-test utilities
│   │   └── utils.ts                  # cn() helper
│   └── types/index.ts                # All TypeScript interfaces
│
└── contracts/                        # Hardhat — Solidity 0.8.24
    ├── contracts/
    │   ├── RestakingGuard.sol         # Main contract
    │   └── IRestakingGuard.sol        # Interface
    ├── test/
    │   └── RestakingGuard.test.ts     # 36 tests, 10 suites
    └── scripts/
        └── deploy.ts                  # Seeds full network on deploy
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript 5, Tailwind CSS |
| Graph Rendering | Canvas 2D API |
| Smart Contracts | Solidity 0.8.24 |
| Contract Tooling | Hardhat, ethers v6, TypeChain |
| Testing | Mocha, Chai |
| Fonts | Syne + Space Mono |

---

## Local Setup

### Prerequisites
- Node.js v20+
- Git

### 1. Install dependencies

```bash
# Frontend
npm install

# Contracts
cd contracts && npm install && cd ..
```

### 2. Run contract tests

```bash
cd contracts
npx hardhat test
```

Expected output: **36 passing**

### 3. Start local blockchain

Open a second terminal:

```bash
cd contracts
npx hardhat node
```

Leave this running.

### 4. Deploy contract locally

Open a third terminal:

```bash
cd contracts
npm run deploy:local
```

Copy the contract address from the output:
```
✓ Deployed at: 0x5FbDB2315...
```

### 5. Configure frontend

Create `stakeguard/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0x5FbDB2315...
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

### 6. Start frontend

```bash
npm run dev
```

Open **http://localhost:3000** — the green LIVE badge confirms the contract connection.

---

## Sepolia Deployment

### Prerequisites
- MetaMask wallet with Sepolia ETH (free from sepoliafaucet.com)
- Alchemy account (free) — for Sepolia RPC URL
- Etherscan account (free, optional) — for contract verification

### 1. Configure contracts environment

```bash
cd contracts
cp .env.example .env
```

Fill in `contracts/.env`:

```
DEPLOYER_PRIVATE_KEY=0xYourMetaMaskPrivateKey
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YourAlchemyKey
ETHERSCAN_API_KEY=YourEtherscanKey
```

> Get your MetaMask private key: MetaMask → Account Details → Export Private Key

### 2. Deploy to Sepolia

```bash
cd contracts
npm run deploy:sepolia
```

Takes 5–10 minutes. Each transaction requires Sepolia block confirmation.

Output:
```
✓ Deployed at: 0xYourContractAddress
Etherscan: https://sepolia.etherscan.io/address/0xYourContractAddress
```

### 3. Verify on Etherscan (optional)

```bash
npx hardhat verify --network sepolia 0xYourContractAddress
```

Requires `ETHERSCAN_API_KEY` to be set.

### 4. Configure frontend

Update `stakeguard/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourContractAddress
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YourAlchemyKey
```

### 5. Restart frontend

```bash
npm run dev
```

LIVE badge now points to Sepolia.

---

## Contract Reference

### Key Functions

| Function | Description |
|----------|-------------|
| `registerValidator(id, stake)` | Register a validator with stake amount |
| `registerAVS(id, name, tvl)` | Register an AVS service |
| `allocateValidator(validatorId, avsId)` | Allocate validator to AVS |
| `reportByzantine(avsId)` | Flag an AVS as Byzantine |
| `executeSlashing(avsId, slashBps)` | Slash all exposed validators |
| `getNetworkSnapshot()` | Returns full network state in one call |
| `getCascadeRisk(avsId)` | Returns cascade risk in basis points |
| `getNetworkRiskScore()` | Returns current risk score 0–99 |

### Key Events

| Event | Emitted When |
|-------|-------------|
| `ValidatorSlashed` | A validator is slashed |
| `CascadeRiskDetected` | A secondary service loses ≥50% of validators |
| `RiskScoreUpdated` | Risk score recalculated after slashing |

### Constants

| Constant | Value | Meaning |
|----------|-------|---------|
| `CASCADE_THRESHOLD_BPS` | 5000 | 50% — cascade trigger threshold |
| `MAX_SLASH_BPS` | 5000 | 50% — maximum slash per incident |
| `PRIMARY_RISK_WEIGHT` | 55 | Stake damage weight in risk formula |
| `CASCADE_RISK_WEIGHT` | 45 | Cascade breadth weight in risk formula |

---

## Research Foundation

> **Elastic Restaking Networks** — (Roi Bar-Zur, PhD Student, Technion)

| Paper Insight | Implementation |
|---------------|---------------|
| Byzantine AVS cascades slashing (§3.2) | `executeSlashing()` → cascade loop |
| Security threshold per service (§3.3) | `CASCADE_THRESHOLD_BPS = 5000` |
| Elastic stake stretching (§3.4) | `slashedStake` tracked separately from `totalStake` |
| Attack profitability estimation (§4) | `attackerProfit = slashed × 0.05` |
| Restaking degree as robustness proxy (§5) | Live metric, drives recommendations |

---

## License

MIT © 2024 StakeGuard
