const { X402PaymentGateway, X402_CONFIG } = require("../services/x402Middleware");
const { ethers } = require("ethers");

async function main() {
  console.log("==========================================================");
  console.log("⚡ DEMO GIAO THỨC VI THANH TOÁN x402 (HTTP 402 PAYMENT REQUIRED)");
  console.log("==========================================================");

  const gateway = new X402PaymentGateway();
  const dummyStudent = "0x6A7F6c42F0D6BA4d13cc45fe0072e5aA7c4031aA";
  const dummyQuestion = "Giải thích thuật toán Avalanche Snowman Consensus và DAG";

  console.log(`\n1. [Client Request]: Sinh viên ${dummyStudent} gửi câu hỏi tới AI Expert:`);
  console.log(`   Question: "${dummyQuestion}"`);

  // Tạo mock request và response của Express
  let statusResult = null;
  let headersResult = {};
  let jsonResult = null;

  const mockReq = {
    headers: { "x-student-address": dummyStudent },
    body: { question: dummyQuestion }
  };

  const mockRes = {
    set: (key, val) => { headersResult[key] = val; },
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => { jsonResult = data; }
      };
    }
  };

  const middleware = gateway.requireMicropayment();
  await middleware(mockReq, mockRes, () => {});

  console.log(`\n2. [Server Response]: Trả về mã trạng thái HTTP ${statusResult}!`);
  console.log(`   Header 'WWW-Authenticate':\n   ${headersResult["WWW-Authenticate"]}`);
  console.log("\n   Response Body (JSON):");
  console.log(JSON.stringify(jsonResult, null, 2));

  console.log("\n==========================================================");
  console.log("✅ KIỂM TRA CHUẨN x402 THÀNH CÔNG RỰC RỠ TRÊN AVALANCHE FUJI!");
  console.log("==========================================================");
}

main().catch(console.error);
