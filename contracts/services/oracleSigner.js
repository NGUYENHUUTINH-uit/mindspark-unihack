const { ethers } = require("ethers");
const deployedData = require("../deployed-addresses.json");

/**
 * @class OracleSigner
 * @notice Dịch vụ ký chứng chỉ mật mã (Cryptographic Attestation) cho các phiên học hợp lệ
 * @dev Dự án MindSpark - Avalanche UniHack 2026
 */
class OracleSigner {
  /**
   * @param {string} oraclePrivateKey Khóa bí mật của ví Oracle
   * @param {string} rpcUrl Địa chỉ RPC của Avalanche Fuji
   * @param {string} vaultAddress Địa chỉ hợp đồng StudyStakeVault (mặc định lấy từ deployed-addresses.json)
   */
  constructor(oraclePrivateKey, rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc", vaultAddress = null) {
    if (!oraclePrivateKey) {
      throw new Error("OracleSigner: Missing oracle private key!");
    }

    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.wallet = new ethers.Wallet(oraclePrivateKey, this.provider);
    this.vaultAddress = vaultAddress || deployedData.contracts.StudyStakeVault.address;
    this.expectedChainId = 43113n; // Avalanche Fuji

    // ABI tối giản của StudyStakeVault để đọc thông tin phiên và nonce
    this.vaultAbi = [
      "function userNonces(address student) view returns (uint256)",
      "function userSessions(address student) view returns (uint256 stakedAmount, uint256 targetMinutes, uint256 startTime, uint256 deadline, bool isActive, bool isClaimed)",
      "function oracleSigner() view returns (address)"
    ];

    this.vaultContract = new ethers.Contract(this.vaultAddress, this.vaultAbi, this.provider);
  }

  /**
   * @notice Lấy địa chỉ ví công khai của Oracle
   */
  getOracleAddress() {
    return this.wallet.address;
  }

  /**
   * @notice Lấy Nonce hiện tại của sinh viên trên hợp đồng thông minh
   * @param {string} studentAddress Địa chỉ ví của sinh viên
   */
  async getStudentNonce(studentAddress) {
    return await this.vaultContract.userNonces(studentAddress);
  }

  /**
   * @notice Đọc trạng thái phiên học hiện tại của sinh viên từ blockchain
   * @param {string} studentAddress
   */
  async getStudentSession(studentAddress) {
    const session = await this.vaultContract.userSessions(studentAddress);
    return {
      stakedAmount: session.stakedAmount,
      targetMinutes: Number(session.targetMinutes),
      startTime: Number(session.startTime),
      deadline: Number(session.deadline),
      isActive: session.isActive,
      isClaimed: session.isClaimed
    };
  }

  /**
   * @notice Tính toán mã băm Keccak256 chuẩn EIP-191 tương thích với StudyStakeVault.sol
   * @param {string} studentAddress
   * @param {number} completedMinutes
   * @param {number} feynmanScore
   * @param {bigint|number} nonce
   * @param {bigint|number} chainId
   */
  computeMessageHash(studentAddress, completedMinutes, feynmanScore, nonce, chainId = this.expectedChainId) {
    return ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256", "uint256", "uint256", "address"],
      [
        ethers.getAddress(studentAddress),
        BigInt(completedMinutes),
        BigInt(feynmanScore),
        BigInt(nonce),
        BigInt(chainId),
        ethers.getAddress(this.vaultAddress)
      ]
    );
  }

  /**
   * @notice Ký chứng nhận phiên học hoàn thành sau khi AI xác thực
   * @param {string} studentAddress Địa chỉ ví của sinh viên
   * @param {number} completedMinutes Số phút thực tế sinh viên đã học
   * @param {number} feynmanScore Điểm phản tư Feynman (thang 1 - 100)
   * @returns {Promise<{ signature: string, messageHash: string, nonce: string, studentAddress: string, completedMinutes: number, feynmanScore: number, vaultAddress: string }>}
   */
  async generateStudyProof(studentAddress, completedMinutes, feynmanScore) {
    if (!ethers.isAddress(studentAddress)) {
      throw new Error(`Invalid student address: ${studentAddress}`);
    }

    if (completedMinutes <= 0) {
      throw new Error("Completed minutes must be greater than 0");
    }

    if (feynmanScore < 50 || feynmanScore > 100) {
      throw new Error(`Feynman score must be between 50 and 100 (Got: ${feynmanScore})`);
    }

    // 1. Kiểm tra session trên on-chain
    const session = await this.getStudentSession(studentAddress);
    if (!session.isActive) {
      throw new Error(`No active study session found for student ${studentAddress}`);
    }

    if (completedMinutes < session.targetMinutes) {
      throw new Error(`Target not reached: Completed ${completedMinutes}m / Target ${session.targetMinutes}m`);
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (currentTimestamp > session.deadline) {
      throw new Error("Study session has expired past the deadline!");
    }

    // 2. Lấy nonce trực tiếp từ blockchain để chống Replay Attack
    const nonce = await this.getStudentNonce(studentAddress);

    // 3. Tính toán Keccak256 Hash
    const messageHash = this.computeMessageHash(
      studentAddress,
      completedMinutes,
      feynmanScore,
      nonce,
      this.expectedChainId
    );

    // 4. Ký thông điệp bằng ECDSA secp256k1 (tự động áp dụng tiền tố EIP-191)
    const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

    return {
      success: true,
      studentAddress: ethers.getAddress(studentAddress),
      completedMinutes: Number(completedMinutes),
      feynmanScore: Number(feynmanScore),
      nonce: nonce.toString(),
      messageHash: messageHash,
      signature: signature,
      vaultAddress: this.vaultAddress,
      chainId: this.expectedChainId.toString()
    };
  }

  /**
   * @notice Xác thực chữ ký cục bộ trước khi gửi lên on-chain (Sanity Check)
   */
  verifySignatureLocally(messageHash, signature) {
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return recovered.toLowerCase() === this.wallet.address.toLowerCase();
  }
}

module.exports = { OracleSigner };
