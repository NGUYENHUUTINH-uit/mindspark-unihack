# 🧠 MindSpark: AI-Supervised Proof of Cognitive Effort on Avalanche

[![MindSpark CI/CD](https://github.com/YOUR_GITHUB_ORG/mindspark-unihack/actions/workflows/ci.yml/badge.svg)](https://github.com/)
[![Avalanche](https://img.shields.io/badge/Blockchain-Avalanche%20Fuji-E84142?logo=avalanche)](https://avax.network/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **UniHack 2026 (Greenwich Vietnam & Avalanche)**  
> **Track:** Social Finance & AI Agent Economy on x402  
> **Core Concept:** Proof of Cognitive Effort (PoCE) - Natural Study Pose Recognition + Feynman 30s Voice Reflection + Inverted x402 Micropayments Stream.

---

## 🏗️ Monorepo Structure

```text
mindspark-unihack/
├── .github/workflows/       # GitHub Actions CI/CD Pipeline (Automated Testing)
├── contracts/               # Avalanche Smart Contracts (Solidity, Hardhat)
│   ├── contracts/           # StudyStakeVault.sol, StudyBadgeSBT.sol
│   ├── scripts/             # deploy.js
│   └── test/                # Unit tests (5/5 passing)
├── ai-service/              # Edge-AI & Backend Services (MediaPipe, Whisper, LLM)
├── frontend/                # Next.js App, Pomodoro Focus Room, Web3 Wallet
└── README.md
```

---

## 🔒 Security & Privacy Guarantees

* **Zero-Knowledge Privacy:** 100% video analysis is processed client-side via **MediaPipe Pose (WebAssembly)**. No frames or video streams are ever uploaded or stored.
* **Cryptographic Oracle Verification:** Smart contracts utilize **ECDSA / EIP-712 cryptographic signatures** to guarantee that rewards are only distributed for verified study sessions.
* **Reentrancy Protection:** All financial vaults are guarded by OpenZeppelin `ReentrancyGuard`.

---

## ⚡ Quick Start (Smart Contracts)

### 1. Install Dependencies
```bash
cd contracts
npm install
```

### 2. Compile Contracts
```bash
npx hardhat compile
```

### 3. Run Automated Tests
```bash
npx hardhat test
```

### 4. Deploy to Avalanche Fuji Testnet
```bash
npx hardhat run scripts/deploy.js --network fuji
```

---

## 👥 Team
* **Tech Lead (Blockchain & Backend):** Architecture, Smart Contracts, x402 Rails, EIP-712.
* **AI Specialist (Computer Vision & NLP):** MediaPipe Pose, Phone Distraction Filter, Feynman Evaluator.
* **Frontend Lead (UI/UX & Pitch):** Next.js, Web3 Wallet, Demo Video, Pitch Deck.
