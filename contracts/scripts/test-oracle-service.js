const { ethers } = require("hardhat");
const { OracleSigner } = require("../services/oracleSigner");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
  console.log("==========================================================");
  console.log("🧪 KIỂM TRA TÍCH HỢP ORACLE SIGNER TRÊN AVALANCHE FUJI");
  console.log("==========================================================");

  const privateKey = process.env.FUJI_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing FUJI_PRIVATE_KEY in .env");
  }

  const oracle = new OracleSigner(privateKey);
  console.log("✅ Oracle Signer Address:", oracle.getOracleAddress());
  console.log("✅ Target Vault Contract:", oracle.vaultAddress);

  // 1. Kiểm tra kết nối tới hợp đồng trên Avalanche Fuji
  const onChainOracle = await oracle.vaultContract.oracleSigner();
  console.log("✅ On-Chain Oracle Signer:", onChainOracle);

  if (onChainOracle.toLowerCase() === oracle.getOracleAddress().toLowerCase()) {
    console.log("🎉 XÁC NHẬN: Ví của bạn CHÍNH LÀ Oracle có thẩm quyền ký trên Avalanche!");
  } else {
    console.log("⚠️ Cảnh báo: Địa chỉ ví Oracle trên hợp đồng khác với ví hiện tại.");
  }

  // 2. Thử nghiệm tính toán Hash và ký chữ ký giả định cho sinh viên
  const dummyStudent = "0x6A7F6c42F0D6BA4d13cc45fe0072e5aA7c4031aA";
  const dummyMinutes = 60;
  const dummyScore = 85;
  const currentNonce = await oracle.getStudentNonce(dummyStudent);

  console.log(`\n📋 Sinh viên: ${dummyStudent}`);
  console.log(`📋 Nonce hiện tại on-chain: ${currentNonce}`);

  const messageHash = oracle.computeMessageHash(dummyStudent, dummyMinutes, dummyScore, currentNonce);
  console.log("🔑 Keccak256 Message Hash:", messageHash);

  const signature = await oracle.wallet.signMessage(ethers.getBytes(messageHash));
  console.log("✍️  ECDSA Signature (65 bytes):", signature);

  const isValidLocal = oracle.verifySignatureLocally(messageHash, signature);
  console.log("✅ Sanity Verification (Local):", isValidLocal ? "HỢP LỆ" : "KHÔNG HỢP LỆ");

  console.log("==========================================================");
  console.log("🚀 TASK MU-8 HOÀN TẤT VÀ SẴN SÀNG GHÉP VÀO TOÀN HỆ THỐNG!");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
});
