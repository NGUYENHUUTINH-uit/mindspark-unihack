# 🧠 MindSpark: AI-Supervised Proof of Cognitive Effort on Avalanche

[![MindSpark CI/CD](https://github.com/NGUYENHUUTINH-uit/mindspark-unihack/actions/workflows/ci.yml/badge.svg)](https://github.com/NGUYENHUUTINH-uit/mindspark-unihack/actions)
[![Avalanche](https://img.shields.io/badge/Blockchain-Avalanche%20Fuji-E84142?logo=avalanche)](https://testnet.snowtrace.io/address/0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **UniHack 2026 (Greenwich Vietnam & Avalanche)**  
> **Track:** Social Finance & AI Agent Economy on x402  
> **Core Concept:** Proof of Cognitive Effort (PoCE) - Natural Study Pose Recognition + Feynman 30s Voice Reflection + Inverted x402 Micropayments Stream + Dynamic Soulbound Skill Tree NFT.

---

## 🚀 Deployed Smart Contracts (Avalanche Fuji Testnet)

| Contract Name | Network | Contract Address | Explorer Link |
| :--- | :---: | :--- | :--- |
| **StudyStakeVault** | Avalanche Fuji (43113) | `0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223) |
| **StudyBadgeSBT** | Avalanche Fuji (43113) | `0x7B8CBC1986855357Ea9383Fd4dd2Aac9C0864B86` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x7B8CBC1986855357Ea9383Fd4dd2Aac9C0864B86) |
| **x402PaymentRail** | Avalanche Fuji (43113) | `0x143B9679eE996F1565654a1833709AB84B7Eea3C` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x143B9679eE996F1565654a1833709AB84B7Eea3C) |

---

## 🎖️ Dynamic Soulbound NFT (StudyBadgeSBT)

MindSpark issues non-transferable Soulbound Tokens (SBT) representing verifiable student achievements:
* **Permanent Binding:** `_update()` hook disables transfers, ensuring badges cannot be traded or stolen.
* **100% On-Chain Dynamic SVG:** Huy hiệu tự động đổi màu và nâng cấp Level (Level 1 $\rightarrow$ Level 5) trực tiếp trên Blockchain mà không phụ thuộc máy chủ Web2.
* **Skill Tree Progression:**
  * **Level 1:** Novice Scholar (Bronze - #CD7F32)
  * **Level 2:** Disciplined Learner (Silver - #C0C0C0)
  * **Level 3:** Avalanche Scholar (Avalanche Red - #E84142)
  * **Level 4:** Cognitive Master (Cyan - #00F5FF)
  * **Level 5:** Grandmaster Scholar (Imperial Gold - #FFD700)

---

## ⚡ x402 Micropayment Protocol on Avalanche (HTTP 402 Standard)

MindSpark implements bidirectional x402 Micropayment Rails conforming to RFC 2616 HTTP 402:

1. **Inverted x402 Bounty Stream:** Sponsors deposit capital into the Bounty Pool. When verified study minutes are attested by the Cryptographic Oracle, micro-rewards are streamed directly to students (`claimStreamPayout`).
2. **Pay-per-Query AI Copilot Gateway:** When students invoke advanced AI Socratic tutoring, the server triggers an `HTTP 402 Payment Required` challenge. Micropayments are settled on-chain (`payForAiQuery`) to unlock real-time answers.

* **Smart Contract:** [`contracts/contracts/x402PaymentRail.sol`](contracts/contracts/x402PaymentRail.sol)
* **Middleware Gateway:** [`contracts/services/x402Middleware.js`](contracts/services/x402Middleware.js)
* **Demo Simulation:** [`contracts/scripts/demo-x402-flow.js`](contracts/scripts/demo-x402-flow.js)

---

## 🔐 Cryptographic Oracle Service (EIP-712 / EIP-191 Attestation)

MindSpark utilizes an off-chain Cryptographic Oracle Relayer to bridge verified AI study proofs into the Avalanche Fuji blockchain without gas costs:

* **Core Service:** [`contracts/services/oracleSigner.js`](contracts/services/oracleSigner.js)
* **RESTful Microservice:** [`contracts/services/oracleServer.js`](contracts/services/oracleServer.js) (`PORT: 4020`)
* **Security & Anti-Tamper:**
  * ✅ ECDSA secp256k1 message signing.
  * ✅ Nonce tracking to prevent Replay Attacks.
  * ✅ Chain ID (43113) & Verifying Contract scoping to block Cross-Chain / Cross-Contract Replay Attacks.
  * ✅ Internal authentication token `x-oracle-auth` protecting against unauthorized callers.

---

## 🏗️ Monorepo Structure

```text
mindspark-unihack/
├── .github/workflows/       # GitHub Actions CI/CD Pipeline (Automated Testing)
├── contracts/               # Avalanche Smart Contracts & Oracle Services
│   ├── contracts/           # StudyStakeVault.sol, x402PaymentRail.sol, StudyBadgeSBT.sol
│   ├── services/            # oracleSigner.js, oracleServer.js, x402Middleware.js, apiGateway.js
│   ├── deployed-addresses.json # Live Fuji Contract Addresses (3 contracts)
│   ├── scripts/             # deploy.js, deploy-sbt.js, deploy-x402.js, verify-all.js, demo-sbt.js, demo-x402-flow.js
│   └── test/                # Automated Unit tests (31/31 passing 100%)
├── ai-service/              # Edge-AI & Backend Services (MediaPipe, Whisper, LLM)
├── frontend/                # Next.js App, Pomodoro Focus Room, Web3 Wallet
└── README.md
```

---

## ⚡ Quick Start (Smart Contracts, Oracle, x402 & SBT)

### 1. Install Dependencies
```bash
cd contracts
npm install
```

### 2. Run All Automated Unit Tests (31/31 Tests Pass 100%)
```bash
npx hardhat test
```

### 3. Start Unified Web3 & x402 API Gateway
```bash
node services/apiGateway.js
```

### 4. Run Dynamic Soulbound NFT Demo
```bash
npx hardhat run scripts/demo-sbt.js
```

### 5. Run x402 HTTP 402 Flow Demo
```bash
npx hardhat run scripts/demo-x402-flow.js
```

### 6. Verify All Contracts on Snowtrace
```bash
node scripts/verify-all.js
```

---

## 👥 Team Roles & Contacts
* **Thành viên 1 (Tech Lead - Blockchain):** Smart Contracts, x402 Rails, Cryptographic Oracle, Soulbound SBT.
* **Thành viên 2 (AI Lead):** MediaPipe Pose, Phone Distraction Filter, Feynman Whisper Evaluator.
* **Thành viên 3 (Frontend & Pitch Lead):** Next.js App, Web3 Wallet, Pitch Deck, Video Demo.
