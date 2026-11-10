const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("----------------------------------------------------");
  console.log("Triển khai StudyBadgeSBT (Soulbound NFT) lên Avalanche Fuji");
  console.log("Ví Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Số dư ví:", ethers.formatEther(balance), "AVAX");

  // 1. Deploy StudyBadgeSBT
  const StudyBadgeSBT = await ethers.getContractFactory("StudyBadgeSBT");
  const sbt = await StudyBadgeSBT.deploy();
  await sbt.waitForDeployment();

  const sbtAddress = await sbt.getAddress();
  console.log("----------------------------------------------------");
  console.log(">>> DEPLOY SOULBOUND NFT THÀNH CÔNG! <<<");
  console.log("StudyBadgeSBT Address:", sbtAddress);
  console.log("Xem trên Snowtrace Testnet:");
  console.log(`https://testnet.snowtrace.io/address/${sbtAddress}`);
  console.log("----------------------------------------------------");

  // Cập nhật file deployed-addresses.json
  const deployedPath = path.join(__dirname, "../deployed-addresses.json");
  let deployedData = {};
  if (fs.existsSync(deployedPath)) {
    deployedData = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));
  }
  if (!deployedData.contracts) deployedData.contracts = {};

  deployedData.contracts.StudyBadgeSBT = {
    address: sbtAddress,
    snowtrace: `https://testnet.snowtrace.io/address/${sbtAddress}`,
    deployer: deployer.address
  };

  fs.writeFileSync(deployedPath, JSON.stringify(deployedData, null, 2));
  console.log("✅ Đã cập nhật địa chỉ vào contracts/deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
