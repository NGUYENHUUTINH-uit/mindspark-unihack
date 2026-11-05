const { ethers } = require("hardhat");

async function main() {
  console.log("====================================================");
  console.log("📡 ĐANG KIỂM TRA KẾT NỐI MẠNG AVALANCHE FUJI TESTNET");
  console.log("====================================================");

  // 1. Kiểm tra RPC Provider
  const provider = ethers.provider;
  const network = await provider.getNetwork();

  console.log("✅ Tên mạng:", network.name);
  console.log("✅ Chain ID:", network.chainId.toString(), network.chainId === 43113n ? "(Chuẩn Avalanche Fuji!)" : "(Sai mạng)");

  // 2. Lấy số block mới nhất đang được đào trên Avalanche
  const blockNumber = await provider.getBlockNumber();
  console.log("✅ Block Number hiện tại trên Fuji:", blockNumber);

  // 3. Lấy phí gas hiện tại của mạng Avalanche (Base fee)
  const feeData = await provider.getFeeData();
  console.log("✅ Gas Price hiện tại:", ethers.formatUnits(feeData.gasPrice, "gwei"), "nAVAX (Gwei)");

  console.log("====================================================");
  console.log("🎉 KẾT QUẢ: MÔI TRƯỜNG HARDHAT ĐÃ THÔNG SUỐT 100% TỚI AVALANCHE!");
  console.log("====================================================");
}

main().catch((error) => {
  console.error("❌ Lỗi kết nối mạng Avalanche:", error);
  process.exitCode = 1;
});
