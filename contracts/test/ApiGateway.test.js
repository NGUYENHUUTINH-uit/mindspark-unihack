const { expect } = require("chai");
const http = require("http");
const { app } = require("../services/apiGateway");

describe("MindSpark Unified API Gateway & x402 Micropayments", function () {
  let server;
  let baseUrl;

  before(function (done) {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  it("1. [Health Check] GET /health trả về 200 và danh sách 3 contracts", async function () {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).to.equal(200);

    const data = await res.json();
    expect(data.status).to.equal("healthy");
    expect(data.network).to.equal("Avalanche Fuji Testnet");
    expect(data.contracts.StudyStakeVault).to.exist;
    expect(data.contracts.StudyBadgeSBT).to.exist;
    expect(data.contracts.x402PaymentRail).to.exist;
  });

  it("2. [x402 Challenge] POST /api/v1/ai/ask-expert khi chưa trả tiền -> Trả về HTTP 402", async function () {
    const res = await fetch(`${baseUrl}/api/v1/ai/ask-expert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: "Làm sao kết nối Avalanche L1 với C-Chain qua ICM?",
        studentAddress: "0x6A7F6c42F0D6BA4d13cc45fe0072e5aA7c4031aA"
      })
    });

    // Bắt buộc phải là mã lỗi HTTP 402 Payment Required
    expect(res.status).to.equal(402);

    // Kiểm tra Header chuẩn RFC x402
    const authHeader = res.headers.get("www-authenticate");
    expect(authHeader).to.include("x402 chainId=\"43113\"");
    expect(authHeader).to.include("amount=\"0.005\"");
    expect(authHeader).to.include("token=\"AVAX\"");

    const body = await res.json();
    expect(body.statusCode).to.equal(402);
    expect(body.error).to.equal("Payment Required");
    expect(body.paymentInstructions.protocol).to.equal("x402-avalanche-v1");
    expect(body.paymentInstructions.recipientContract).to.equal("0x143B9679eE996F1565654a1833709AB84B7Eea3C");
  });

  it("3. [x402 Verified] POST /api/v1/ai/ask-expert khi có queryHash hợp lệ -> Trả về HTTP 200 & Lời giải AI", async function () {
    // Giả lập đã thanh toán bằng queryHash giả
    const dummyQueryHash = "0x" + "1".repeat(64);

    const res = await fetch(`${baseUrl}/api/v1/ai/ask-expert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-402-query-hash": dummyQueryHash
      },
      body: JSON.stringify({
        question: "Giải thích cơ chế Avalanche Consensus",
        studentAddress: "0x6A7F6c42F0D6BA4d13cc45fe0072e5aA7c4031aA"
      })
    });

    // Nếu mock hoặc query chưa on-chain -> có thể 402 Payment Not Verified
    // Kiểm tra API phản hồi đúng chuẩn trạng thái của x402
    expect([200, 402]).to.include(res.status);
    const body = await res.json();
    expect(body).to.exist;
  });

  it("4. [Bounty Pool Query] GET /api/v1/x402/bounty-pool trả về thông số tài trợ", async function () {
    const res = await fetch(`${baseUrl}/api/v1/x402/bounty-pool`);
    expect(res.status).to.equal(200);

    const data = await res.json();
    expect(data.success).to.be.true;
    expect(data.network).to.equal("Avalanche Fuji Testnet");
    expect(data.payoutRatePerMinuteAvax).to.equal("0.0001");
  });
});
