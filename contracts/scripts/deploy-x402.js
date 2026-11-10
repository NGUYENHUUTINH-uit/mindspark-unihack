const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("----------------------------------------------------");
  console.log("Triển khai x402PaymentRail lên Avalanche Fuji Testnet");
  console.log("Ví Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Số dư ví:", ethers.formatEther(balance), "AVAX");

  const oracleSigner = process.env.ORACLE_ADDRESS || deployer.address;
  console.log("Ví Oracle Signer:", oracleSigner);

  // Deploy x402PaymentRail
  const x402PaymentRail = await ethers.getContractFactory("x402PaymentRail");
  const rail = await x402PaymentRail.deploy(oracleSigner);
  await rail.waitForDeployment();

  const railAddress = await rail.getAddress();
  console.log("----------------------------------------------------");
  console.log(">>> DEPLOY x402 PAYMENT RAIL THÀNH CÔNG! <<<");
  console.log("x402PaymentRail Address:", railAddress);
  console.log("Xem trên Snowtrace Testnet:");
  console.log(`https://testnet.snowtrace.io/address/${railAddress}`);
  console.log("----------------------------------------------------");

  // Cập nhật file deployed-addresses.json
  const deployedPath = path.join(__dirname, "../deployed-addresses.json");
  let deployedData = {};
  if (fs.existsSync(deployedPath)) {
    deployedData = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));
  }
  if (!deployedData.contracts) deployedData.contracts = {};

  deployedData.contracts.x402PaymentRail = {
    address: railAddress,
    snowtrace: `https://testnet.snowtrace.io/address/${railAddress}`,
    deployer: deployer.address
  };

  fs.writeFileSync(deployedPath, JSON.stringify(deployedData, null, 2));
  console.log("✅ Đã cập nhật địa chỉ vào contracts/deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
