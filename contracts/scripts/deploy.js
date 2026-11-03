const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("----------------------------------------------------");
  console.log("Triển khai MindSpark Smart Contracts lên Avalanche Fuji");
  console.log("Ví deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Số dư ví:", ethers.formatEther(balance), "AVAX");

  // Oracle signer: Mặc định dùng địa chỉ deployer hoặc cấu hình trong .env
  const oracleSigner = process.env.ORACLE_ADDRESS || deployer.address;
  console.log("Ví Oracle Signer được cấp quyền:", oracleSigner);

  // 1. Deploy StudyStakeVault
  const StudyStakeVault = await ethers.getContractFactory("StudyStakeVault");
  const vault = await StudyStakeVault.deploy(oracleSigner);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("----------------------------------------------------");
  console.log(">>> DEPLOY THÀNH CÔNG! <<<");
  console.log("StudyStakeVault Address:", vaultAddress);
  console.log("Xem trên Snowtrace Testnet:");
  console.log(`https://testnet.snowtrace.io/address/${vaultAddress}`);
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
