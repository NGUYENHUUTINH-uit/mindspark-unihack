const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StudyBadgeSBT Contract (Dynamic Soulbound NFT)", function () {
  let sbt, owner, vaultMinter, student1, student2, hacker;

  beforeEach(async function () {
    [owner, vaultMinter, student1, student2, hacker] = await ethers.getSigners();

    const StudyBadgeSBT = await ethers.getContractFactory("StudyBadgeSBT");
    sbt = await StudyBadgeSBT.deploy();
    await sbt.waitForDeployment();

    // Ủy quyền cho vaultMinter (giả lập hợp đồng StudyStakeVault)
    await sbt.setAuthorizedCaller(vaultMinter.address, true);
  });

  describe("1. Khởi tạo & Mint Thẻ Sinh viên Soulbound", function () {
    it("Cho phép authorized caller mint thẻ SBT cho sinh viên", async function () {
      await expect(sbt.connect(vaultMinter).mintBadge(student1.address))
        .to.emit(sbt, "BadgeMinted")
        .withArgs(student1.address, 1, 1);

      expect(await sbt.balanceOf(student1.address)).to.equal(1n);
      expect(await sbt.ownerOf(1)).to.equal(student1.address);
      expect(await sbt.studentToBadgeId(student1.address)).to.equal(1n);

      const metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(1);
      expect(metrics.totalMinutes).to.equal(0);
    });

    it("Chặn không cho 1 sinh viên sở hữu 2 thẻ", async function () {
      await sbt.connect(vaultMinter).mintBadge(student1.address);

      await expect(
        sbt.connect(vaultMinter).mintBadge(student1.address)
      ).to.be.revertedWith("Student already owns a MindSpark Badge");
    });
  });

  describe("2. Tính chất Soulbound (Bất khả chuyển nhượng)", function () {
    beforeEach(async function () {
      await sbt.connect(vaultMinter).mintBadge(student1.address);
    });

    it("Chặn hoàn toàn hàm transferFrom", async function () {
      await expect(
        sbt.connect(student1).transferFrom(student1.address, student2.address, 1)
      ).to.be.revertedWith("Soulbound: Token is permanently bound to this wallet and cannot be transferred");
    });

    it("Chặn hoàn toàn hàm safeTransferFrom", async function () {
      await expect(
        sbt.connect(student1)["safeTransferFrom(address,address,uint256)"](student1.address, student2.address, 1)
      ).to.be.revertedWith("Soulbound: Token is permanently bound to this wallet and cannot be transferred");
    });

    it("Chặn kẻ xấu cố tình approve và transfer", async function () {
      await expect(
        sbt.connect(hacker).transferFrom(student1.address, hacker.address, 1)
      ).to.be.revertedWith("Soulbound: Token is permanently bound to this wallet and cannot be transferred");
    });
  });

  describe("3. Thăng cấp Động theo giờ học (Dynamic Level-Up)", function () {
    it("Tự động thăng cấp từ Level 1 lên Level 5 theo tiến trình học tập", async function () {
      // Phiên 1: Học 120 phút, điểm 90 -> Vẫn Level 1 (< 300 phút)
      await sbt.connect(vaultMinter).recordStudyProgress(student1.address, 120, 90);
      let metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(1);
      expect(metrics.totalMinutes).to.equal(120);

      // Phiên 2: Học thêm 200 phút (tổng 320 phút) -> Lên Level 2 (Disciplined Learner)
      await expect(sbt.connect(vaultMinter).recordStudyProgress(student1.address, 200, 85))
        .to.emit(sbt, "BadgeLevelUp")
        .withArgs(student1.address, 1, 1, 2, 320);

      metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(2);

      // Phiên 3: Học thêm 600 phút (tổng 920 phút) -> Lên Level 3 (Avalanche Scholar)
      await expect(sbt.connect(vaultMinter).recordStudyProgress(student1.address, 600, 90))
        .to.emit(sbt, "BadgeLevelUp")
        .withArgs(student1.address, 1, 2, 3, 920);

      metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(3);

      // Phiên 4: Học thêm 900 phút (tổng 1820 phút) -> Lên Level 4 (Cognitive Master)
      await expect(sbt.connect(vaultMinter).recordStudyProgress(student1.address, 900, 95))
        .to.emit(sbt, "BadgeLevelUp")
        .withArgs(student1.address, 1, 3, 4, 1820);

      metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(4);

      // Phiên 5: Học thêm 1200 phút (tổng 3020 phút, điểm trung bình cao) -> Lên Level 5 (Grandmaster)
      await expect(sbt.connect(vaultMinter).recordStudyProgress(student1.address, 1200, 90))
        .to.emit(sbt, "BadgeLevelUp")
        .withArgs(student1.address, 1, 4, 5, 3020);

      metrics = await sbt.badgeMetrics(1);
      expect(metrics.level).to.equal(5);
      expect(await sbt.getLevelTitle(5)).to.equal("Grandmaster Scholar");
      expect(await sbt.getLevelColor(5)).to.equal("#FFD700");
    });
  });

  describe("4. On-Chain Dynamic SVG & Metadata JSON", function () {
    it("tokenURI trả về chuỗi JSON base64 hợp lệ chứa thông tin Level và SVG", async function () {
      await sbt.connect(vaultMinter).recordStudyProgress(student1.address, 350, 92); // Level 2

      const uri = await sbt.tokenURI(1);
      expect(uri).to.include("data:application/json;base64,");

      // Giải mã base64 JSON
      const base64Json = uri.replace("data:application/json;base64,", "");
      const decodedJson = JSON.parse(Buffer.from(base64Json, "base64").toString("utf-8"));

      expect(decodedJson.name).to.include("MindSpark Scholar Badge #1");
      expect(decodedJson.name).to.include("Disciplined Learner");
      expect(decodedJson.image).to.include("data:image/svg+xml;base64,");

      // Giải mã ảnh SVG bên trong
      const base64Svg = decodedJson.image.replace("data:image/svg+xml;base64,", "");
      const decodedSvg = Buffer.from(base64Svg, "base64").toString("utf-8");

      expect(decodedSvg).to.include("<svg");
      expect(decodedSvg).to.include("LVL 2");
      expect(decodedSvg).to.include("Disciplined Learner");
      expect(decodedSvg).to.include("#C0C0C0"); // Màu bạc Level 2
      expect(decodedSvg).to.include("Total Study Time:");
    });
  });

  describe("5. Phân quyền bảo mật (Access Control)", function () {
    it("Từ chối nếu người không được ủy quyền cố tình gọi recordStudyProgress", async function () {
      await expect(
        sbt.connect(hacker).recordStudyProgress(student1.address, 100, 90)
      ).to.be.revertedWith("Caller is not authorized");
    });
  });
});
