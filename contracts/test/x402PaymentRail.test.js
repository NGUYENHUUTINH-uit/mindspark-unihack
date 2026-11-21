const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("x402PaymentRail Contract (Inverted Streams & Pay-per-Query)", function () {
  let rail, owner, oracleWallet, sponsor, student, hacker;
  let chainId;

  beforeEach(async function () {
    [owner, sponsor, student, hacker] = await ethers.getSigners();
    oracleWallet = ethers.Wallet.createRandom();

    const x402PaymentRail = await ethers.getContractFactory("x402PaymentRail");
    rail = await x402PaymentRail.deploy(oracleWallet.address);
    await rail.waitForDeployment();

    chainId = (await ethers.provider.getNetwork()).chainId;
  });

  describe("1. Inverted x402 Stream: Tài trợ học bổng theo phút", function () {
    it("Cho phép doanh nghiệp nạp quỹ học bổng (Bounty Pool)", async function () {
      const fundAmount = ethers.parseEther("1.0"); // 1 AVAX
      await expect(
        rail.connect(sponsor).fundBounty("Avalanche Builder DAO", { value: fundAmount })
      )
        .to.emit(rail, "BountyFunded")
        .withArgs(sponsor.address, "Avalanche Builder DAO", fundAmount, fundAmount);

      expect(await rail.totalBountyPool()).to.equal(fundAmount);
      const sponsorInfo = await rail.sponsors(sponsor.address);
      expect(sponsorInfo.name).to.equal("Avalanche Builder DAO");
      expect(sponsorInfo.totalContributed).to.equal(fundAmount);
    });

    it("Sinh viên stream nhận tiền thưởng theo số phút học có chữ ký Oracle", async function () {
      // 1. Nạp quỹ tài trợ
      const fundAmount = ethers.parseEther("1.0");
      await rail.connect(sponsor).fundBounty("Avalanche Builder DAO", { value: fundAmount });

      // 2. Sinh viên học 60 phút tập trung
      const minutesFocused = 60;
      const ratePerMinute = await rail.payoutRatePerMinute(); // 0.0001 AVAX / phút
      const expectedPayout = BigInt(minutesFocused) * ratePerMinute; // 0.006 AVAX
      const nonce = await rail.studentClaimedNonces(student.address);
      const railAddress = await rail.getAddress();

      // Oracle ký xác thực vi thanh toán
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "uint256", "address"],
        [student.address, minutesFocused, expectedPayout, nonce, chainId, railAddress]
      );
      const signature = await oracleWallet.signMessage(ethers.getBytes(messageHash));

      // 3. Sinh viên claim vi thanh toán
      const balanceBefore = await ethers.provider.getBalance(student.address);
      const tx = await rail.connect(student).claimStreamPayout(minutesFocused, signature);
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(student.address);

      expect(balanceAfter).to.be.closeTo(balanceBefore + expectedPayout - gasCost, ethers.parseEther("0.0001"));
      expect(await rail.totalBountyPool()).to.equal(fundAmount - expectedPayout);
      expect(await rail.studentClaimedNonces(student.address)).to.equal(1n);
    });

    it("Từ chối nếu hacker giả mạo chữ ký để rút tiền từ Bounty Pool", async function () {
      await rail.connect(sponsor).fundBounty("Avalanche Builder DAO", { value: ethers.parseEther("1.0") });

      const minutes = 60;
      const payout = BigInt(minutes) * (await rail.payoutRatePerMinute());
      const nonce = await rail.studentClaimedNonces(student.address);
      const railAddress = await rail.getAddress();

      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "uint256", "uint256", "uint256", "address"],
        [student.address, minutes, payout, nonce, chainId, railAddress]
      );

      // Hacker tự ký
      const fakeSignature = await hacker.signMessage(ethers.getBytes(messageHash));

      await expect(
        rail.connect(student).claimStreamPayout(minutes, fakeSignature)
      ).to.be.revertedWith("Invalid Oracle signature for stream payout");
    });
  });

  describe("2. Pay-per-Query (HTTP 402 AI Expert Copilot)", function () {
    it("Sinh viên thanh toán vi mô 0.005 AVAX để mở khóa câu hỏi AI", async function () {
      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("Hỏi AI giải bài tập Cây nhị phân"));
      const price = await rail.aiQueryPrice(); // 0.005 AVAX

      expect(await rail.isQueryPaid(queryHash)).to.be.false;

      const tx = await rail.connect(student).payForAiQuery(queryHash, { value: price });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(rail, "AiQueryPaid")
        .withArgs(student.address, queryHash, price, block.timestamp);

      expect(await rail.isQueryPaid(queryHash)).to.be.true;
    });

    it("Báo lỗi nếu sinh viên gửi thiếu phí vi thanh toán", async function () {
      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("Hỏi AI bài toán"));
      const insufficientPrice = ethers.parseEther("0.001"); // Cần 0.005

      await expect(
        rail.connect(student).payForAiQuery(queryHash, { value: insufficientPrice })
      ).to.be.revertedWith("Insufficient query payment");
    });

    it("Ngăn chặn thanh toán lặp lại cho cùng 1 query hash đã xử lý", async function () {
      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("Hỏi AI bài toán 2"));
      const price = await rail.aiQueryPrice();

      await rail.connect(student).payForAiQuery(queryHash, { value: price });

      await expect(
        rail.connect(student).payForAiQuery(queryHash, { value: price })
      ).to.be.revertedWith("Query hash already paid and processed");
    });
  });

  describe("3. Quản trị & Tách biệt doanh thu AI với Quỹ Bounty Pool", function () {
    it("Chỉ cho phép rút doanh thu AI, bảo toàn 100% tiền của Bounty Pool", async function () {
      // 1. Sponsor nạp 1 AVAX vào Bounty Pool
      await rail.connect(sponsor).fundBounty("Sponsor Fund", { value: ethers.parseEther("1.0") });

      // 2. Sinh viên trả 0.005 AVAX phí AI query
      const queryHash = ethers.keccak256(ethers.toUtf8Bytes("Query 1"));
      await rail.connect(student).payForAiQuery(queryHash, { value: ethers.parseEther("0.005") });

      // 3. Owner rút doanh thu
      const recipient = hacker; // Tạm dùng ví này nhận tiền
      const balBefore = await ethers.provider.getBalance(recipient.address);

      await rail.connect(owner).withdrawQueryRevenue(recipient.address);

      const balAfter = await ethers.provider.getBalance(recipient.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("0.005"));

      // Bounty pool 1.0 AVAX vẫn còn nguyên vẹn trong contract
      expect(await rail.totalBountyPool()).to.equal(ethers.parseEther("1.0"));
    });
  });
});
