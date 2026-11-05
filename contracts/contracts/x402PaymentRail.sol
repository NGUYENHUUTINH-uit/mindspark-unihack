// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title x402PaymentRail
 * @notice Khung thanh toán vi mô chuẩn HTTP 402 hai chiều trên Avalanche Fuji
 * @dev Hỗ trợ:
 * 1. Inverted x402 Stream: Doanh nghiệp tài trợ tiền thưởng theo phút học cho sinh viên
 * 2. Pay-per-Query: Sinh viên thanh toán vi mô để mở khóa câu trả lời của AI Expert Copilot
 */
contract x402PaymentRail is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Địa chỉ ví Oracle xác thực phiên học
    address public oracleSigner;

    // Tỷ lệ thưởng theo phút từ quỹ tài trợ (mặc định: 0.0001 AVAX / phút)
    uint256 public payoutRatePerMinute = 0.0001 ether;

    // Phí tiêu chuẩn cho mỗi lượt truy vấn AI nâng cao (mặc định: 0.005 AVAX)
    uint256 public aiQueryPrice = 0.005 ether;

    // Tổng số quỹ tài trợ khả dụng
    uint256 public totalBountyPool;

    // Cấu trúc thông tin nhà tài trợ
    struct SponsorInfo {
        string name;
        uint256 totalContributed;
        uint256 remainingBalance;
    }

    mapping(address => SponsorInfo) public sponsors;
    mapping(address => uint256) public studentClaimedNonces;
    mapping(bytes32 => bool) public processedQueries;

    // Events chuẩn x402
    event BountyFunded(address indexed sponsor, string name, uint256 amount, uint256 newTotal);
    event MicroStreamPaid(address indexed student, uint256 minutesCount, uint256 amountPaid, uint256 nonce);
    event AiQueryPaid(address indexed student, bytes32 indexed queryHash, uint256 amount, uint256 timestamp);
    event RatesUpdated(uint256 newPayoutRate, uint256 newQueryPrice);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    constructor(address _oracleSigner) Ownable(msg.sender) {
        require(_oracleSigner != address(0), "Invalid Oracle address");
        oracleSigner = _oracleSigner;
    }

    // =========================================================================
    // 1. INVERTED x402 STREAM (DOANH NGHIỆP TÀI TRỢ SINH VIÊN THEO PHÚT)
    // =========================================================================

    /**
     * @notice Doanh nghiệp/Nhà tài trợ nạp tiền vào Quỹ tài trợ học bổng (Bounty Pool)
     * @param sponsorName Tên tổ chức/doanh nghiệp tài trợ (ví dụ: "Avalanche Ecosystem Fund")
     */
    function fundBounty(string calldata sponsorName) external payable nonReentrant {
        require(msg.value > 0, "Funding amount must be > 0");

        SponsorInfo storage info = sponsors[msg.sender];
        if (bytes(info.name).length == 0) {
            info.name = sponsorName;
        }
        info.totalContributed += msg.value;
        info.remainingBalance += msg.value;
        totalBountyPool += msg.value;

        emit BountyFunded(msg.sender, info.name, msg.value, totalBountyPool);
    }

    /**
     * @notice Sinh viên claim vi thanh toán dựa trên số phút học tập trung có Oracle chứng thực
     * @param minutesFocused Số phút sinh viên đã học tập trung
     * @param signature Chữ ký của Oracle xác thực phiên học
     */
    function claimStreamPayout(
        uint256 minutesFocused,
        bytes calldata signature
    ) external nonReentrant {
        require(minutesFocused > 0, "Minutes must be > 0");

        uint256 currentNonce = studentClaimedNonces[msg.sender];
        uint256 payoutAmount = minutesFocused * payoutRatePerMinute;

        require(totalBountyPool >= payoutAmount, "Bounty pool insufficient funds");

        // 1. Xác thực chữ ký Oracle
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                minutesFocused,
                payoutAmount,
                currentNonce,
                block.chainid,
                address(this)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(ethSignedHash, signature);
        require(recovered == oracleSigner, "Invalid Oracle signature for stream payout");

        // 2. Cập nhật trạng thái
        studentClaimedNonces[msg.sender] += 1;
        totalBountyPool -= payoutAmount;

        // 3. Giải ngân vi thanh toán về ví sinh viên
        (bool success, ) = payable(msg.sender).call{value: payoutAmount}("");
        require(success, "Stream payout transfer failed");

        emit MicroStreamPaid(msg.sender, minutesFocused, payoutAmount, currentNonce);
    }

    // =========================================================================
    // 2. PAY-PER-QUERY (SINH VIÊN TRẢ PHÍ VI MÔ GỌI AI COPILOT)
    // =========================================================================

    /**
     * @notice Sinh viên thanh toán vi mô cho 1 lượt truy vấn AI nâng cao
     * @param queryHash Mã băm của câu hỏi hoặc request ID từ máy chủ HTTP 402
     */
    function payForAiQuery(bytes32 queryHash) external payable nonReentrant {
        require(msg.value >= aiQueryPrice, "Insufficient query payment");
        require(!processedQueries[queryHash], "Query hash already paid and processed");

        processedQueries[queryHash] = true;

        emit AiQueryPaid(msg.sender, queryHash, msg.value, block.timestamp);
    }

    /**
     * @notice Kiểm tra xem một mã câu hỏi đã được thanh toán on-chain hay chưa
     */
    function isQueryPaid(bytes32 queryHash) external view returns (bool) {
        return processedQueries[queryHash];
    }

    // =========================================================================
    // 3. QUẢN TRỊ & CẤU HÌNH HỆ THỐNG
    // =========================================================================

    function setRates(uint256 _newPayoutRate, uint256 _newQueryPrice) external onlyOwner {
        payoutRatePerMinute = _newPayoutRate;
        aiQueryPrice = _newQueryPrice;
        emit RatesUpdated(_newPayoutRate, _newQueryPrice);
    }

    function setOracleSigner(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Zero address");
        emit OracleUpdated(oracleSigner, _newOracle);
        oracleSigner = _newOracle;
    }

    /**
     * @notice Rút doanh thu tích lũy từ phí truy vấn AI (chỉ Owner)
     */
    function withdrawQueryRevenue(address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Zero address");
        uint256 contractBalance = address(this).balance;
        // Giữ lại tiền của Bounty Pool, chỉ rút phần doanh thu AI
        require(contractBalance >= totalBountyPool, "No revenue available beyond bounty pool");
        uint256 revenue = contractBalance - totalBountyPool;
        require(revenue > 0, "Zero revenue to withdraw");

        (bool success, ) = recipient.call{value: revenue}("");
        require(success, "Revenue transfer failed");
    }

    receive() external payable {
        totalBountyPool += msg.value;
    }
}
