const { expect } = require("chai");
const { ethers } = require("hardhat");
const { OracleSigner } = require("../services/oracleSigner");

describe("OracleSigner & Cryptographic Attestation Verification", function () {
  let vault, owner, oracleWallet, student1, student2, hackerWallet;
  let oracleService;
  let vaultAddress;
  let chainId;

  beforeEach(async function () {
    [owner, student1, student2] = await ethers.getSigners();

    // Tạo một ví riêng làm Oracle ngẫu nhiên với Private Key xác định
    oracleWallet = ethers.Wallet.createRandom();
    hackerWallet = ethers.Wallet.createRandom();

    // 1. Deploy StudyStakeVault với địa chỉ Oracle
    const StudyStakeVault = await ethers.getContractFactory("StudyStakeVault");
    vault = await StudyStakeVault.deploy(oracleWallet.address);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();

    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;

    // 2. Khởi tạo OracleSigner instance
    oracleService = new OracleSigner(oracleWallet.privateKey, "http://127.0.0.1:8545", vaultAddress);
    // Ghi đè provider bằng provider của Hardhat test
    oracleService.provider = ethers.provider;
    oracleService.wallet = new ethers.Wallet(oracleWallet.privateKey, ethers.provider);
    oracleService.vaultContract = new ethers.Contract(vaultAddress, oracleService.vaultAbi, ethers.provider);
    oracleService.expectedChainId = chainId;
  });

  it("1. [Sanity Check] Oracle address khớp 100% giữa Contract và Oracle Service", async function () {
    expect(await vault.oracleSigner()).to.equal(oracleWallet.address);
    expect(oracleService.getOracleAddress()).to.equal(oracleWallet.address);
  });

  it("2. [Happy Path] Sinh viên cọc tiền -> Oracle ký -> Rút cọc và nhận thưởng thành công", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    const targetMinutes = 60; // 1 giờ
    const durationDays = 7;

    // Bước 1: Sinh viên stake
    await vault.connect(student1).stake(targetMinutes, durationDays, { value: stakeAmount });

    // Bước 2: AI xác nhận sinh viên học 75 phút, điểm phản tư 88/100
    const completedMinutes = 75;
    const feynmanScore = 88;

    // Oracle Service sinh chứng chỉ mật mã
    const proof = await oracleService.generateStudyProof(
      student1.address,
      completedMinutes,
      feynmanScore
    );

    expect(proof.success).to.be.true;
    expect(proof.studentAddress).to.equal(student1.address);
    expect(oracleService.verifySignatureLocally(proof.messageHash, proof.signature)).to.be.true;

    // Bước 3: Sinh viên nộp proof lên Avalanche Contract
    const balanceBefore = await ethers.provider.getBalance(student1.address);

    const tx = await vault.connect(student1).claimReward(
      completedMinutes,
      feynmanScore,
      proof.signature
    );
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;

    const balanceAfter = await ethers.provider.getBalance(student1.address);

    // Xác nhận tiền cọc đã được hoàn trả về ví
    expect(balanceAfter).to.be.closeTo(balanceBefore + stakeAmount - gasUsed, ethers.parseEther("0.001"));

    const session = await vault.userSessions(student1.address);
    expect(session.isActive).to.be.false;
    expect(session.isClaimed).to.be.true;
  });

  it("3. [Anti-Tampering] Từ chối ngay nếu hacker sửa điểm Feynman cao hơn thực tế", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });

    const completedMinutes = 65;
    const realScore = 55;

    // Oracle ký cho điểm thật: 55
    const proof = await oracleService.generateStudyProof(student1.address, completedMinutes, realScore);

    // Kẻ gian sửa tham số gửi lên blockchain: cố tình đổi điểm thành 99 để nhận thưởng lớn
    const tamperedScore = 99;

    await expect(
      vault.connect(student1).claimReward(completedMinutes, tamperedScore, proof.signature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });

  it("4. [Anti-Tampering] Từ chối ngay nếu sinh viên tự ý khai khống số phút học", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });

    const realMinutes = 65;
    const score = 80;

    const proof = await oracleService.generateStudyProof(student1.address, realMinutes, score);

    // Hacker cố tình đổi số phút lên 1000 phút
    const fakeMinutes = 1000;

    await expect(
      vault.connect(student1).claimReward(fakeMinutes, score, proof.signature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });

  it("5. [Identity Theft Protection] Kẻ xấu lấy trộm chữ ký của sinh viên khác không thể dùng được", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });
    await vault.connect(student2).stake(60, 7, { value: stakeAmount });

    // Oracle cấp chữ ký cho student1
    const proof = await oracleService.generateStudyProof(student1.address, 65, 85);

    // Student 2 (kẻ xấu) lấy trộm chữ ký đó để gọi rút tiền cho ví của mình
    await expect(
      vault.connect(student2).claimReward(65, 85, proof.signature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });

  it("6. [Anti-Replay Attack] Chữ ký cũ không bao giờ được dùng lại lần thứ hai", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });

    const proof = await oracleService.generateStudyProof(student1.address, 65, 85);

    // Lần 1: Rút cọc thành công
    await vault.connect(student1).claimReward(65, 85, proof.signature);

    // Sinh viên cọc phiên mới
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });

    // Thử dùng lại chữ ký của phiên học cũ
    await expect(
      vault.connect(student1).claimReward(65, 85, proof.signature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });

  it("7. [Cross-Chain Protection] Chữ ký tạo cho Chain khác bị từ chối trên mạng hiện tại", async function () {
    const stakeAmount = ethers.parseEther("0.1");
    await vault.connect(student1).stake(60, 7, { value: stakeAmount });

    const nonce = await vault.userNonces(student1.address);
    const fakeChainId = 1n; // Ethereum Mainnet thay vì Avalanche

    // Ký với Chain ID giả
    const fakeMessageHash = oracleService.computeMessageHash(
      student1.address,
      65,
      85,
      nonce,
      fakeChainId
    );
    const fakeSignature = await oracleWallet.signMessage(ethers.getBytes(fakeMessageHash));

    await expect(
      vault.connect(student1).claimReward(65, 85, fakeSignature)
    ).to.be.revertedWith("Invalid Oracle signature");
  });
});
