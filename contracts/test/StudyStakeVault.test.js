const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StudyStakeVault Contract", function () {
  let vault, owner, oracle, student1, student2;

  beforeEach(async function () {
    [owner, oracle, student1, student2] = await ethers.getSigners();

    const StudyStakeVault = await ethers.getContractFactory("StudyStakeVault");
    vault = await StudyStakeVault.deploy(oracle.address);
    await vault.waitForDeployment();
  });

  it("Should set the correct oracle signer", async function () {
    expect(await vault.oracleSigner()).to.equal(oracle.address);
  });

  it("Should allow student to stake AVAX for study session", async function () {
    const stakeAmount = ethers.parseEther("0.1"); // 0.1 AVAX
    const targetMinutes = 120; // 2 hours
    const durationDays = 7;

    const tx = await vault.connect(student1).stake(targetMinutes, durationDays, { value: stakeAmount });
    await expect(tx).to.emit(vault, "Staked");

    const session = await vault.userSessions(student1.address);
    expect(session.stakedAmount).to.equal(stakeAmount);
    expect(session.targetMinutes).to.equal(targetMinutes);
    expect(session.isActive).to.be.true;
    expect(session.isClaimed).to.be.false;
  });

  it("Should allow student to claim reward with valid Oracle signature", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    const targetMinutes = 120;
    const durationDays = 7;

    // 1. Sinh viên cọc tiền
    await vault.connect(student1).stake(targetMinutes, durationDays, { value: stakeAmount });

    // 2. Mô phỏng sinh viên hoàn thành: học 130 phút, điểm Feynman 85
    const completedMinutes = 130;
    const feynmanScore = 85;
    const nonce = await vault.userNonces(student1.address);
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    const vaultAddress = await vault.getAddress();

    // 3. Oracle ký message hash
    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "uint256", "uint256", "address"],
      [student1.address, completedMinutes, feynmanScore, nonce, chainId, vaultAddress]
    );

    const signature = await oracle.signMessage(ethers.getBytes(messageHash));

    // 4. Sinh viên gọi claimReward kèm signature
    const balanceBefore = await ethers.provider.getBalance(student1.address);

    const tx = await vault.connect(student1).claimReward(completedMinutes, feynmanScore, signature);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const balanceAfter = await ethers.provider.getBalance(student1.address);

    // Kiểm tra số dư được hoàn lại cọc
    expect(balanceAfter).to.be.closeTo(balanceBefore + stakeAmount - gasUsed, ethers.parseEther("0.001"));

    const session = await vault.userSessions(student1.address);
    expect(session.isActive).to.be.false;
    expect(session.isClaimed).to.be.true;
  });

  it("Should reject invalid signature from non-oracle address", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(120, 7, { value: stakeAmount });

    const completedMinutes = 130;
    const feynmanScore = 85;
    const nonce = await vault.userNonces(student1.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const vaultAddress = await vault.getAddress();

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "uint256", "uint256", "address"],
      [student1.address, completedMinutes, feynmanScore, nonce, chainId, vaultAddress]
    );

    // Ký bằng student2 (hacker) thay vì oracle
    const invalidSignature = await student2.signMessage(ethers.getBytes(messageHash));

    await expect(
      vault.connect(student1).claimReward(completedMinutes, feynmanScore, invalidSignature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });

  it("Should allow penalizing a student who fails the deadline", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student2).stake(120, 7, { value: stakeAmount });

    // Tua nhanh thời gian thêm 8 ngày (vượt quá 7 ngày deadline)
    await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]);
    await ethers.provider.send("evm_mine");

    await expect(vault.penalize(student2.address))
      .to.emit(vault, "Penalized")
      .withArgs(student2.address, stakeAmount);

    expect(await vault.penaltyPool()).to.equal(stakeAmount);
    const session = await vault.userSessions(student2.address);
    expect(session.isActive).to.be.false;
  });
});
