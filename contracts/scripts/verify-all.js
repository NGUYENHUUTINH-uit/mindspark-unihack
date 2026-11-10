const hre = require("hardhat");
const deployedData = require("../deployed-addresses.json");

async function main() {
  console.log("==========================================================");
  console.log("🔍 TIẾN HÀNH XÁC THỰC MÃ NGUỒN (VERIFY CONTRACTS) TRÊN SNOWTRACE");
  console.log("==========================================================");

  const [deployer] = await hre.ethers.getSigners();
  const oracleAddress = process.env.ORACLE_ADDRESS || deployer.address;

  const contracts = deployedData.contracts;

  // 1. Verify StudyStakeVault
  if (contracts.StudyStakeVault) {
    console.log(`\n1. Đang verify StudyStakeVault tại: ${contracts.StudyStakeVault.address}...`);
    try {
      await hre.run("verify:verify", {
        address: contracts.StudyStakeVault.address,
        constructorArguments: [oracleAddress],
      });
      console.log("   ✅ StudyStakeVault verified thành công!");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("   ✅ Hợp đồng đã được verify trước đó trên Snowtrace.");
      } else {
        console.log(`   ℹ️ Kết quả: ${err.message}`);
      }
    }
  }

  // 2. Verify StudyBadgeSBT
  if (contracts.StudyBadgeSBT) {
    console.log(`\n2. Đang verify StudyBadgeSBT tại: ${contracts.StudyBadgeSBT.address}...`);
    try {
      await hre.run("verify:verify", {
        address: contracts.StudyBadgeSBT.address,
        constructorArguments: [],
      });
      console.log("   ✅ StudyBadgeSBT verified thành công!");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("   ✅ Hợp đồng đã được verify trước đó trên Snowtrace.");
      } else {
        console.log(`   ℹ️ Kết quả: ${err.message}`);
      }
    }
  }

  // 3. Verify x402PaymentRail
  if (contracts.x402PaymentRail) {
    console.log(`\n3. Đang verify x402PaymentRail tại: ${contracts.x402PaymentRail.address}...`);
    try {
      await hre.run("verify:verify", {
        address: contracts.x402PaymentRail.address,
        constructorArguments: [oracleAddress],
      });
      console.log("   ✅ x402PaymentRail verified thành công!");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("   ✅ Hợp đồng đã được verify trước đó trên Snowtrace.");
      } else {
        console.log(`   ℹ️ Kết quả: ${err.message}`);
      }
    }
  }

  console.log("\n==========================================================");
  console.log("🎉 HOÀN TẤT QUY TRÌNH KIỂM CHỨNG TRÊN SNOWTRACE EXPLORER!");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("❌ Lỗi verify script:", err);
  process.exit(1);
});
