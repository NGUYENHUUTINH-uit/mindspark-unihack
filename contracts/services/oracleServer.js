const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { OracleSigner } = require("./oracleSigner");

dotenv.config();

const app = express();
const PORT = process.env.ORACLE_PORT || 4020;
const DEFAULT_TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY || process.env.FUJI_PRIVATE_KEY || DEFAULT_TEST_KEY;
const INTERNAL_SECRET = process.env.INTERNAL_AI_SECRET || "mindspark-internal-secret-2026";

if (!process.env.ORACLE_PRIVATE_KEY && !process.env.FUJI_PRIVATE_KEY) {
  console.log("ℹ️ CI/Testing Mode: Using default test key for Oracle Server.");
}

// Khởi tạo thực thể Oracle Signer
const oracleSigner = new OracleSigner(ORACLE_PRIVATE_KEY);

app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
});

/**
 * @route GET /health
 * @desc Kiểm tra tình trạng hoạt động của Oracle Relayer và kết nối mạng Avalanche
 */
app.get("/health", async (req, res) => {
  try {
    const blockNumber = await oracleSigner.provider.getBlockNumber();
    res.json({
      status: "healthy",
      service: "MindSpark Cryptographic Oracle",
      oracleAddress: oracleSigner.getOracleAddress(),
      vaultAddress: oracleSigner.vaultAddress,
      network: "Avalanche Fuji Testnet",
      chainId: 43113,
      currentBlockNumber: blockNumber,
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({ status: "degraded", error: err.message });
  }
});

/**
 * @route GET /api/v1/oracle/session/:studentAddress
 * @desc Tra cứu trực tiếp trạng thái phiên học và Nonce của sinh viên trên Avalanche Fuji
 */
app.get("/api/v1/oracle/session/:studentAddress", async (req, res) => {
  try {
    const { studentAddress } = req.params;
    const session = await oracleSigner.getStudentSession(studentAddress);
    const nonce = await oracleSigner.getStudentNonce(studentAddress);

    res.json({
      success: true,
      studentAddress,
      session,
      currentNonce: nonce.toString()
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * @route POST /api/v1/oracle/attest
 * @desc Ký xác thực mật mã phiên học (Chỉ chấp nhận từ AI Service có secret token)
 */
app.post("/api/v1/oracle/attest", async (req, res) => {
  try {
    const authHeader = req.headers["x-oracle-auth"];
    if (authHeader !== INTERNAL_SECRET) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid or missing x-oracle-auth secret header!"
      });
    }

    const { studentAddress, completedMinutes, feynmanScore } = req.body;

    if (!studentAddress || completedMinutes === undefined || feynmanScore === undefined) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: studentAddress, completedMinutes, feynmanScore"
      });
    }

    console.log(`[Oracle] Bắt đầu tạo chứng chỉ mật mã cho sinh viên: ${studentAddress}`);
    console.log(`[Oracle] Số phút hoàn thành: ${completedMinutes}m | Điểm Feynman: ${feynmanScore}`);

    const proof = await oracleSigner.generateStudyProof(
      studentAddress,
      completedMinutes,
      feynmanScore
    );

    console.log(`[Oracle] ✅ Đã ký thành công chữ ký ECDSA: ${proof.signature.substring(0, 20)}...`);

    res.json(proof);
  } catch (err) {
    console.error(`[Oracle] ❌ Thất bại: ${err.message}`);
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log("==========================================================");
    console.log(`🧠 MINDSPARK CRYPTOGRAPHIC ORACLE SERVER STARTED ON PORT ${PORT}`);
    console.log(`📍 Oracle Public Key: ${oracleSigner.getOracleAddress()}`);
    console.log(`🔒 Vault Contract:    ${oracleSigner.vaultAddress}`);
    console.log(`📡 Avalanche Network:  Avalanche Fuji Testnet (Chain ID 43113)`);
    console.log("==========================================================");
  });
}

module.exports = { app, oracleSigner };
