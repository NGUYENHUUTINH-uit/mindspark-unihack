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

## 🏗️ Monorepo Structure

```text
mindspark-unihack/
├── .github/workflows/       # GitHub Actions CI/CD Pipeline (Automated Testing)
├── contracts/               # Avalanche Smart Contracts (Solidity, Hardhat)
│   ├── contracts/           # StudyStakeVault.sol
│   ├── deployed-addresses.json # Live Fuji Contract Addresses
│   ├── scripts/             # deploy.js, check-network.js
│   └── test/                # Automated Unit tests (5/5 passing)
├── ai-service/              # Edge-AI & Backend Services (MediaPipe, Whisper, LLM)
├── frontend/                # Next.js App, Pomodoro Focus Room, Web3 Wallet
└── README.md
```

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

---

## 👥 Team Roles & Contacts
* **Thành viên 1 (Tech Lead - Blockchain):** Smart Contracts, x402 Rails, Cryptographic Oracle.
* **Thành viên 2 (AI Lead):** MediaPipe Pose, Phone Distraction Filter, Feynman Whisper Evaluator.
* **Thành viên 3 (Frontend & Pitch Lead):** Next.js App, Web3 Wallet, Pitch Deck, Video Demo.
