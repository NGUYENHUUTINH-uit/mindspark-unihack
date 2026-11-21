const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { ethers } = require("ethers");
const { OracleSigner } = require("./oracleSigner");
const { X402PaymentGateway, X402_CONFIG } = require("./x402Middleware");
const deployedData = require("../deployed-addresses.json");

dotenv.config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 4020;
const DEFAULT_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY || process.env.FUJI_PRIVATE_KEY || DEFAULT_TEST_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_AI_SECRET || "mindspark-internal-secret-2026";
const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/\/$/, "");
// Chỉ bật khi quay demo: cho phép Frontend xin chữ ký với điểm cố định khi AI Service offline.
const ENABLE_DEMO_ATTEST = String(process.env.ENABLE_DEMO_ATTEST || "false").toLowerCase() === "true";
const DEMO_ATTEST_SCORE = 75;

if (!process.env.ORACLE_PRIVATE_KEY && !process.env.FUJI_PRIVATE_KEY) {
  console.log("ℹ️ CI/Testing Mode: Using default test key for Oracle Signer.");
}

// Khởi tạo các dịch vụ Web3
const oracleSigner = new OracleSigner(ORACLE_PRIVATE_KEY);
const x402Gateway = new X402PaymentGateway(deployedData.contracts?.x402PaymentRail?.address);

const VAULT_ADDRESS = deployedData.contracts.StudyStakeVault.address;
const SBT_ADDRESS = deployedData.contracts.StudyBadgeSBT.address;
const RAIL_ADDRESS = deployedData.contracts.x402PaymentRail.address;

const vaultIface = new ethers.Interface([
  "function claimReward(uint256 completedMinutes, uint256 feynmanScore, bytes signature)",
  "event RewardClaimed(address indexed student, uint256 refundAmount, uint256 bonusReward, uint256 feynmanScore)",
]);
const sbtWriter = new ethers.Contract(
  SBT_ADDRESS,
  [
    "function recordStudyProgress(address student, uint256 sessionMinutes, uint256 feynmanScore) returns (uint8)",
    "function studentToBadgeId(address) view returns (uint256)",
    "function authorizedCallers(address) view returns (bool)",
    "function owner() view returns (address)",
  ],
  oracleSigner.wallet
);
const railReader = new ethers.Contract(
  RAIL_ADDRESS,
  [
    "function studentClaimedNonces(address) view returns (uint256)",
    "function payoutRatePerMinute() view returns (uint256)",
    "function totalBountyPool() view returns (uint256)",
  ],
  oracleSigner.provider
);

// -------------------------------------------------------------------------
// Lưu các claim tx đã xử lý để chống dùng lại 1 tx nhiều lần (kể cả sau restart)
// -------------------------------------------------------------------------
const PROCESSED_FILE = path.join(__dirname, "..", ".gateway-processed.json");
const loadProcessed = () => {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, "utf8")));
  } catch {
    return new Set();
  }
};
const processedClaims = loadProcessed();
const saveProcessed = () => {
  try {
    fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...processedClaims]));
  } catch (err) {
    console.warn("[Gateway] Không ghi được file processed:", err.message);
  }
};

/**
 * Kiểm tra ví Oracle đang chạy có khớp ví oracleSigner đã cấu hình on-chain không.
 * Nếu lệch → mọi chữ ký sẽ bị contract từ chối (Invalid Oracle signature).
 */
let cachedOnChainOracle = null;
let cachedOracleMatches = null;

async function checkOracleKeyMatchesChain() {
  try {
    const vault = new ethers.Contract(VAULT_ADDRESS, ["function oracleSigner() view returns (address)"], oracleSigner.provider);
    const onchain = await vault.oracleSigner();
    const local = oracleSigner.getOracleAddress();
    cachedOnChainOracle = onchain;
    cachedOracleMatches = onchain.toLowerCase() === local.toLowerCase();
    if (!cachedOracleMatches) {
      console.log("==========================================================");
      console.log("❌ CẢNH BÁO: Ví Oracle KHÔNG khớp với StudyStakeVault.oracleSigner()!");
      console.log(`   On-chain: ${onchain}`);
      console.log(`   Local:    ${local}`);
      console.log("   → claimReward() sẽ REVERT 'Invalid Oracle signature'.");
      console.log("   → Đặt ORACLE_PRIVATE_KEY (hoặc FUJI_PRIVATE_KEY) đúng ví trong contracts/.env");
      console.log("==========================================================");
      return false;
    }
    console.log(`✅ Oracle key khớp on-chain oracleSigner (${onchain})`);
    return true;
  } catch (err) {
    console.warn("⚠️ Không kiểm tra được oracleSigner on-chain:", err.message);
    return null;
  }
}

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// =========================================================================
// 1. HEALTH & ECOSYSTEM STATUS
// =========================================================================

app.get("/health", async (req, res) => {
  let blockNumber = 0;
  try {
    blockNumber = await Promise.race([
      oracleSigner.provider.getBlockNumber(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout")), 2500))
    ]);
  } catch (err) {
    blockNumber = 60440000; // Fallback Fuji block
  }

  if (cachedOnChainOracle === null) {
    await checkOracleKeyMatchesChain();
  }

  res.json({
    status: "healthy",
    service: "MindSpark Unified Web3 & x402 Gateway",
    network: "Avalanche Fuji Testnet",
    chainId: 43113,
    currentBlock: blockNumber,
    oracleAddress: oracleSigner.getOracleAddress(),
    onChainOracleAddress: cachedOnChainOracle,
    oracleKeyMatchesChain: cachedOracleMatches,
    demoAttestEnabled: ENABLE_DEMO_ATTEST,
    contracts: deployedData.contracts
  });
});

// =========================================================================
// 2. CRYPTOGRAPHIC ORACLE ATTESTATION (TASK MU-8)
// =========================================================================

// Chỉ AI Service (server-to-server) được gọi — secret KHÔNG bao giờ đặt ở Frontend.
app.post("/api/v1/oracle/attest", async (req, res) => {
  try {
    const authHeader = req.headers["x-oracle-auth"];
    if (authHeader !== INTERNAL_SECRET) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing x-oracle-auth secret token!"
      });
    }

    const { studentAddress, completedMinutes, feynmanScore } = req.body;
    const proof = await oracleSigner.generateStudyProof(studentAddress, completedMinutes, feynmanScore);
    res.json(proof);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/v1/oracle/demo-attest
 * @desc Fallback CHỈ dùng khi quay demo mà AI Service offline. Tắt mặc định.
 *       Điểm cố định 75 (không cho client tự chọn điểm) để không phá cơ chế chống gian lận.
 */
app.post("/api/v1/oracle/demo-attest", async (req, res) => {
  if (!ENABLE_DEMO_ATTEST) {
    return res.status(403).json({
      success: false,
      error: "Demo attest đang tắt. Bật ENABLE_DEMO_ATTEST=true trong contracts/.env nếu cần quay demo offline."
    });
  }
  try {
    const { studentAddress, completedMinutes } = req.body;
    const proof = await oracleSigner.generateStudyProof(studentAddress, completedMinutes, DEMO_ATTEST_SCORE);
    res.json({ ...proof, demo: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/api/v1/oracle/session/:studentAddress", async (req, res) => {
  try {
    const session = await oracleSigner.getStudentSession(req.params.studentAddress);
    const nonce = await oracleSigner.getStudentNonce(req.params.studentAddress);
    res.json({
      success: true,
      session: { ...session, stakedAmount: session.stakedAmount.toString() },
      nonce: nonce.toString()
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. SESSION FINALIZE: SBT LEVEL-UP + x402 STREAM ATTESTATION (MU-9, MU-10)
// =========================================================================

/**
 * Xác minh 1 giao dịch claimReward thành công trên Vault, trả về {student, minutes, score}.
 * Mọi dữ liệu đọc từ blockchain → client không thể khai khống.
 */
async function verifyClaimTx(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || "")) throw new Error("txHash không hợp lệ");
  const [tx, receipt] = await Promise.all([
    oracleSigner.provider.getTransaction(txHash),
    oracleSigner.provider.getTransactionReceipt(txHash),
  ]);
  if (!tx || !receipt) throw new Error("Không tìm thấy giao dịch (có thể chưa được mined)");
  if (receipt.status !== 1) throw new Error("Giao dịch claim đã thất bại on-chain");
  if ((tx.to || "").toLowerCase() !== VAULT_ADDRESS.toLowerCase()) throw new Error("Giao dịch không gửi tới StudyStakeVault");

  const parsedCall = vaultIface.parseTransaction({ data: tx.data });
  if (!parsedCall || parsedCall.name !== "claimReward") throw new Error("Giao dịch không phải claimReward");

  const claimedLog = receipt.logs
    .filter((l) => l.address.toLowerCase() === VAULT_ADDRESS.toLowerCase())
    .map((l) => { try { return vaultIface.parseLog(l); } catch { return null; } })
    .find((l) => l && l.name === "RewardClaimed");
  if (!claimedLog) throw new Error("Không tìm thấy event RewardClaimed");

  return {
    student: ethers.getAddress(claimedLog.args.student),
    minutes: Number(parsedCall.args.completedMinutes),
    feynmanScore: Number(claimedLog.args.feynmanScore),
  };
}

/**
 * @route POST /api/v1/session/finalize
 * @body { txHash }  — hash giao dịch claimReward đã thành công
 * @desc 1) Ghi tiến độ + mint/level-up Soulbound NFT (Oracle trả gas thay sinh viên)
 *       2) Ký chứng chỉ x402 claimStreamPayout nếu Bounty Pool đủ tiền
 */
app.post("/api/v1/session/finalize", async (req, res) => {
  const { txHash } = req.body || {};
  try {
    const claim = await verifyClaimTx(txHash);
    const key = txHash.toLowerCase();
    const result = { success: true, ...claim, sbt: null, stream: null };

    // --- 1. Soulbound NFT ---
    if (processedClaims.has(key)) {
      result.sbt = { skipped: true, reason: "Giao dịch này đã được ghi nhận SBT trước đó" };
    } else {
      try {
        const sbtTx = await sbtWriter.recordStudyProgress(claim.student, claim.minutes, claim.feynmanScore);
        await sbtTx.wait();
        processedClaims.add(key);
        saveProcessed();
        const tokenId = await sbtWriter.studentToBadgeId(claim.student);
        result.sbt = { txHash: sbtTx.hash, tokenId: tokenId.toString() };
      } catch (err) {
        result.sbt = { error: err.shortMessage || err.message };
      }
    }

    // --- 2. x402 Inverted Stream (học bổng theo phút) ---
    try {
      const [rate, pool, nonce] = await Promise.all([
        railReader.payoutRatePerMinute(),
        railReader.totalBountyPool(),
        railReader.studentClaimedNonces(claim.student),
      ]);
      const payout = BigInt(claim.minutes) * rate;
      if (pool >= payout) {
        const msgHash = ethers.solidityPackedKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "address"],
          [claim.student, claim.minutes, payout, nonce, 43113n, RAIL_ADDRESS]
        );
        const signature = await oracleSigner.wallet.signMessage(ethers.getBytes(msgHash));
        result.stream = {
          minutesFocused: claim.minutes,
          payoutWei: payout.toString(),
          payoutAvax: ethers.formatEther(payout),
          nonce: nonce.toString(),
          signature,
          contract: RAIL_ADDRESS,
        };
      } else {
        result.stream = { unavailable: true, reason: `Bounty Pool không đủ (${ethers.formatEther(pool)} AVAX)` };
      }
    } catch (err) {
      result.stream = { error: err.shortMessage || err.message };
    }

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. x402 MICROPAYMENT AI EXPERT COPILOT (TASK MU-9 & MU-11)
// =========================================================================

/** Gọi AI Service sinh câu trả lời + flashcard thật; fallback tĩnh nếu offline. */
async function askCopilot(question) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(`${AI_SERVICE_URL}/api/copilot/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-oracle-auth": INTERNAL_SECRET },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.answer && data.flashcard) {
        return {
          source: "gemini",
          topic: data.topic || "AI Socratic Copilot",
          explanation: data.answer,
          flashcardSuggestion: { front: data.flashcard.question, back: data.flashcard.answer },
        };
      }
    }
  } catch (err) {
    console.warn("[AI Copilot] AI Service không phản hồi, dùng câu trả lời dự phòng:", err.message);
  }
  return {
    source: "fallback",
    topic: "AI Socratic Copilot (offline)",
    explanation: `AI Service đang offline nên chưa thể phân tích sâu câu hỏi: "${question}". Khoản vi thanh toán đã được ghi nhận on-chain — bạn có thể hỏi lại khi dịch vụ AI hoạt động.`,
    flashcardSuggestion: {
      front: question,
      back: "Câu trả lời sẽ được AI cập nhật khi dịch vụ hoạt động trở lại.",
    },
  };
}

/**
 * @route POST /api/v1/ai/ask-expert
 * @desc Gọi AI Expert phân tích bài tập nâng cao - Bảo vệ bằng chuẩn HTTP 402
 */
app.post(
  "/api/v1/ai/ask-expert",
  x402Gateway.requireMicropayment(),
  async (req, res) => {
    const { question, studentAddress } = req.body;

    console.log(`[AI Copilot] Đang xử lý câu hỏi sau khi xác nhận vi thanh toán: "${question}"`);
    const copilotAnswer = await askCopilot(String(question || "").slice(0, 1000));

    res.json({
      success: true,
      statusCode: 200,
      protocol: "x402-avalanche-v1",
      verifiedQueryHash: req.verifiedQueryHash,
      studentAddress: studentAddress,
      copilotAnswer,
      timestamp: Date.now()
    });
  }
);

/**
 * @route GET /api/v1/x402/bounty-pool
 * @desc Đọc số dư quỹ tài trợ học bổng Bounty Pool on-chain
 */
app.get("/api/v1/x402/bounty-pool", async (req, res) => {
  try {
    const totalBounty = await x402Gateway.contract.totalBountyPool();
    res.json({
      success: true,
      totalBountyPoolWei: totalBounty.toString(),
      totalBountyPoolAvax: (Number(totalBounty) / 1e18).toFixed(4),
      payoutRatePerMinuteAvax: "0.0001",
      network: "Avalanche Fuji Testnet"
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log("==========================================================");
    console.log(`🌐 MINDSPARK UNIFIED WEB3 & x402 GATEWAY RUNNING ON PORT ${PORT}`);
    console.log(`📍 Oracle Signer:   ${oracleSigner.getOracleAddress()}`);
    console.log(`💎 StudyStakeVault: ${VAULT_ADDRESS}`);
    console.log(`🎖️ StudyBadgeSBT:   ${SBT_ADDRESS}`);
    console.log(`⚡ x402PaymentRail: ${RAIL_ADDRESS}`);
    console.log(`🧠 AI Service:      ${AI_SERVICE_URL}`);
    console.log(`🎬 Demo attest:     ${ENABLE_DEMO_ATTEST ? "BẬT" : "tắt"}`);
    console.log("==========================================================");
    await checkOracleKeyMatchesChain();
  });
}

module.exports = { app };
