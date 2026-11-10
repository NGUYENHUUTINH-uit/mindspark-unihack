const { ethers } = require("ethers");
const deployedData = require("../deployed-addresses.json");

const paymentRailAddress = deployedData.contracts?.x402PaymentRail?.address || "0x143B9679eE996F1565654a1833709AB84B7Eea3C";

/**
 * @notice Cấu hình chuẩn x402 Micropayment trên Avalanche Fuji
 */
const X402_CONFIG = {
  chainId: 43113n,
  networkName: "Avalanche Fuji Testnet",
  standardPriceAvax: "0.005",
  standardPriceWei: ethers.parseEther("0.005"),
  paymentRailAddress: paymentRailAddress,
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc"
};

/**
 * @class X402PaymentGateway
 * @notice Cổng xử lý mã trạng thái HTTP 402 và xác minh thanh toán vi mô On-Chain
 */
class X402PaymentGateway {
  constructor(railAddress = null, rpcUrl = X402_CONFIG.rpcUrl) {
    this.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.paymentRailAddress = railAddress || X402_CONFIG.paymentRailAddress;

    this.railAbi = [
      "function isQueryPaid(bytes32 queryHash) view returns (bool)",
      "function aiQueryPrice() view returns (uint256)",
      "function totalBountyPool() view returns (uint256)"
    ];

    this.contract = new ethers.Contract(this.paymentRailAddress, this.railAbi, this.provider);
  }

  generateQueryHash(studentAddress, questionText) {
    const timestamp = Math.floor(Date.now() / 1000);
    return ethers.solidityPackedKeccak256(
      ["address", "string", "uint256"],
      [studentAddress, questionText, timestamp]
    );
  }

  requireMicropayment() {
    return async (req, res, next) => {
      const studentAddress = req.headers["x-student-address"] || req.body.studentAddress;
      const queryHash = req.headers["x-402-query-hash"];

      // 1. Nếu chưa có header X-402-Query-Hash -> Trả về HTTP 402 Payment Required
      if (!queryHash) {
        const questionText = req.body.question || "Default AI Consultation";
        const generatedHash = studentAddress 
          ? this.generateQueryHash(studentAddress, questionText)
          : ethers.hexlify(ethers.randomBytes(32));

        res.set("WWW-Authenticate", `x402 chainId="43113", recipient="${this.paymentRailAddress}", amount="${X402_CONFIG.standardPriceAvax}", token="AVAX", hash="${generatedHash}"`);

        return res.status(402).json({
          statusCode: 402,
          error: "Payment Required",
          message: "Truy cập AI Expert Copilot yêu cầu vi thanh toán 0.005 AVAX trên Avalanche Fuji theo chuẩn x402.",
          paymentInstructions: {
            protocol: "x402-avalanche-v1",
            chainId: 43113,
            network: X402_CONFIG.networkName,
            recipientContract: this.paymentRailAddress,
            method: "payForAiQuery(bytes32 queryHash)",
            queryHash: generatedHash,
            priceAvax: X402_CONFIG.standardPriceAvax,
            priceWei: X402_CONFIG.standardPriceWei.toString(),
            hint: "Gửi giao dịch payForAiQuery(queryHash) lên contract trên Avalanche Fuji, sau đó gọi lại API kèm Header: 'X-402-Query-Hash': queryHash"
          }
        });
      }

      // 2. Nếu đã có header -> Kiểm tra xác thực On-chain qua RPC Fuji
      try {
        const isPaid = await this.contract.isQueryPaid(queryHash);
        if (!isPaid) {
          return res.status(402).json({
            statusCode: 402,
            error: "Payment Not Verified",
            message: "Khoản vi thanh toán cho Query Hash này chưa được ghi nhận trên Blockchain Avalanche Fuji.",
            queryHash: queryHash
          });
        }

        console.log(`[x402 Gateway] ✅ Xác nhận vi thanh toán On-chain hợp lệ cho Query Hash: ${queryHash}`);
        req.x402Verified = true;
        req.verifiedQueryHash = queryHash;
        next();
      } catch (err) {
        return res.status(500).json({
          statusCode: 500,
          error: "Payment Verification Failed",
          details: err.message
        });
      }
    };
  }
}

module.exports = { X402PaymentGateway, X402_CONFIG };
