# 🧠 MindSpark: AI-Supervised Proof of Cognitive Effort on Avalanche

[![MindSpark CI/CD](https://github.com/NGUYENHUUTINH-uit/mindspark-unihack/actions/workflows/ci.yml/badge.svg)](https://github.com/NGUYENHUUTINH-uit/mindspark-unihack/actions)
[![Avalanche](https://img.shields.io/badge/Blockchain-Avalanche%20Fuji-E84142?logo=avalanche)](https://testnet.snowtrace.io/address/0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **UniHack 2026 (Greenwich Vietnam & Avalanche)**  
> **Track:** Social Finance & AI Agent Economy on x402  
> **Core Concept:** Proof of Cognitive Effort (PoCE) - Natural Study Pose Recognition + Feynman 30s Voice Reflection + Inverted x402 Micropayments Stream.

---

## 🚀 Deployed Smart Contracts (Avalanche Fuji Testnet)

| Contract Name | Network | Contract Address | Explorer Link |
| :--- | :---: | :--- | :--- |
| **StudyStakeVault** | Avalanche Fuji (43113) | `0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x62A647BD25a4AfD418cFDDAD99cbA3e49B775223) |

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
│   ├── contracts/           # StudyStakeVault.sol, x402PaymentRail.sol
│   ├── services/            # oracleSigner.js, oracleServer.js, x402Middleware.js
│   ├── deployed-addresses.json # Live Fuji Contract Addresses
│   ├── scripts/             # deploy.js, check-network.js, test-oracle-service.js, demo-x402-flow.js
│   └── test/                # Automated Unit tests (19/19 passing)
├── ai-service/              # Edge-AI & Backend Services (MediaPipe, Whisper, LLM)
├── frontend/                # Next.js App, Pomodoro Focus Room, Web3 Wallet
└── README.md
```

---

## ⚡ Quick Start (Smart Contracts, Oracle & x402)

### 1. Install Dependencies
```bash
cd contracts
npm install
```

### 2. Run All Automated Unit Tests (19/19 Tests)
```bash
npx hardhat test
```

### 3. Run x402 Protocol Demo
```bash
node scripts/demo-x402-flow.js
```

### 4. Start Cryptographic Oracle Server
```bash
node services/oracleServer.js
```

---

## 👥 Team Roles & Contacts
* **Thành viên 1 (Tech Lead - Blockchain):** Smart Contracts, x402 Rails, Cryptographic Oracle.
* **Thành viên 2 (AI Lead):** MediaPipe Pose, Phone Distraction Filter, Feynman Whisper Evaluator.
* **Thành viên 3 (Frontend & Pitch Lead):** Next.js App, Web3 Wallet, Pitch Deck, Video Demo.
