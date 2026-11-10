const { ethers } = require("hardhat");

async function main() {
  console.log("==========================================================");
  console.log("🎨 DEMO SOULBOUND NFT ĐỘNG (ON-CHAIN SVG & METADATA JSON)");
  console.log("==========================================================");

  const [owner, student] = await ethers.getSigners();
  const StudyBadgeSBT = await ethers.getContractFactory("StudyBadgeSBT");
  const sbt = await StudyBadgeSBT.deploy();
  await sbt.waitForDeployment();

  console.log("✅ StudyBadgeSBT deployed tại:", await sbt.getAddress());

  // 1. Mint thẻ cho sinh viên
  await sbt.mintBadge(student.address);
  console.log(`\n1. Mint thẻ ban đầu cho sinh viên: ${student.address}`);
  console.log("   - Cấp bậc ban đầu: Level 1 (Novice Scholar)");

  // 2. Tự động thăng cấp sau khi học 950 phút
  console.log("\n2. Sinh viên hoàn thành các phiên học (Tích lũy 950 phút, điểm Feynman: 90)...");
  await sbt.recordStudyProgress(student.address, 950, 90);

  const metrics = await sbt.badgeMetrics(1);
  const title = await sbt.getLevelTitle(metrics.level);
  const color = await sbt.getLevelColor(metrics.level);

  console.log(`   - Cấp bậc mới: Level ${metrics.level} (${title})`);
  console.log(`   - Màu sắc huy hiệu: ${color}`);
  console.log(`   - Tổng số phút: ${metrics.totalMinutes} phút (~${(Number(metrics.totalMinutes) / 60).toFixed(1)} giờ)`);

  // 3. Trích xuất tokenURI
  const uri = await sbt.tokenURI(1);
  const base64Json = uri.replace("data:application/json;base64,", "");
  const decodedJson = JSON.parse(Buffer.from(base64Json, "base64").toString("utf-8"));

  console.log("\n3. Metadata On-Chain giải mã từ Blockchain (Base64 JSON):");
  console.log(JSON.stringify({
    name: decodedJson.name,
    description: decodedJson.description,
    attributes: decodedJson.attributes
  }, null, 2));

  console.log("\n==========================================================");
  console.log("🚀 TASK MU-10 HOÀN THÀNH VÀ SẴN SÀNG TÍCH HỢP GIAO DIỆN WEB!");
  console.log("==========================================================");
}

main().catch(console.error);
