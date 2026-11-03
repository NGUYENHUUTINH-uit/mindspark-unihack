// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StudyStakeVault
 * @notice Smart contract quản lý cọc cam kết học tập, phân phối thưởng & phạt trên Avalanche Fuji
 * @dev Dự án MindSpark - UniHack 2026
 */
contract StudyStakeVault is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Địa chỉ ví Oracle của hệ thống (dùng để ký xác thực kết quả học tập từ AI)
    address public oracleSigner;

    // Quỹ thưởng tích lũy từ những người bị phạt
    uint256 public penaltyPool;

    // Phí cọc tối thiểu (ví dụ: 0.05 AVAX testnet)
    uint256 public constant MINIMUM_STAKE = 0.01 ether;

    struct StudySession {
        uint256 stakedAmount;     // Số tiền AVAX đang cọc
        uint256 targetMinutes;    // Mục tiêu số phút học cam kết
        uint256 startTime;        // Thời điểm bắt đầu cọc
        uint256 deadline;         // Hạn chót hoàn thành (thường là 7 ngày)
        bool isActive;            // Trạng thái cọc đang mở
        bool isClaimed;           // Đã nhận lại tiền cọc và thưởng chưa
    }

    // Mapping từ địa chỉ sinh viên -> Thông tin phiên cọc
    mapping(address => StudySession) public userSessions;

    // Mapping theo dõi nonce chống tấn công Replay Attack chữ ký
    mapping(address => uint256) public userNonces;

    // Events
    event Staked(address indexed student, uint256 amount, uint256 targetMinutes, uint256 deadline);
    event RewardClaimed(address indexed student, uint256 refundAmount, uint256 bonusReward, uint256 feynmanScore);
    event Penalized(address indexed student, uint256 forfeitedAmount);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event BountyFunded(address indexed sponsor, uint256 amount);

    constructor(address _oracleSigner) Ownable(msg.sender) {
        require(_oracleSigner != address(0), "Invalid Oracle address");
        oracleSigner = _oracleSigner;
    }

    /**
     * @notice Sinh viên đặt cọc AVAX để cam kết mục tiêu học tập
     * @param targetMinutes Số phút cam kết học (ví dụ: 600 phút = 10 tiếng)
     * @param durationDays Thời hạn cam kết (ví dụ: 7 ngày)
     */
    function stake(uint256 targetMinutes, uint256 durationDays) external payable nonReentrant {
        require(msg.value >= MINIMUM_STAKE, "Stake amount below minimum");
        require(targetMinutes >= 30, "Minimum target is 30 minutes");
        require(durationDays >= 1 && durationDays <= 30, "Duration between 1 and 30 days");

        StudySession storage session = userSessions[msg.sender];
        require(!session.isActive, "Already have an active stake session");

        session.stakedAmount = msg.value;
        session.targetMinutes = targetMinutes;
        session.startTime = block.timestamp;
        session.deadline = block.timestamp + (durationDays * 1 days);
        session.isActive = true;
        session.isClaimed = false;

        emit Staked(msg.sender, msg.value, targetMinutes, session.deadline);
    }

    /**
     * @notice Sinh viên rút lại cọc + nhận thưởng khi hoàn thành mục tiêu học và được AI xác thực
     * @param completedMinutes Số phút thực tế đã học (do AI Pose xác nhận)
     * @param feynmanScore Điểm phản tư Feynman do AI chấm (thang điểm 1 - 100)
     * @param signature Chữ ký mật mã cryptographic từ Oracle của hệ thống
     */
    function claimReward(
        uint256 completedMinutes,
        uint256 feynmanScore,
        bytes calldata signature
    ) external nonReentrant {
        StudySession storage session = userSessions[msg.sender];
        require(session.isActive, "No active study session");
        require(!session.isClaimed, "Reward already claimed");
        require(block.timestamp <= session.deadline, "Session deadline passed");
        require(completedMinutes >= session.targetMinutes, "Target hours not reached");
        require(feynmanScore >= 50, "Feynman reflection score too low (min 50)");

        // 1. Xác thực chữ ký Oracle để chống giả mạo kết quả học tập
        uint256 currentNonce = userNonces[msg.sender];
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                completedMinutes,
                feynmanScore,
                currentNonce,
                block.chainid,
                address(this)
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recoveredSigner = ECDSA.recover(ethSignedHash, signature);

        require(recoveredSigner == oracleSigner, "Invalid Oracle signature");

        // Tăng nonce để chống Replay Attack
        userNonces[msg.sender] += 1;

        // 2. Tính toán tiền hoàn trả + Phần thưởng
        uint256 refundAmount = session.stakedAmount;
        uint256 bonusReward = 0;

        // Nếu có quỹ phạt từ người vi phạm, trích 10% thưởng thêm cho người chăm chỉ
        if (penaltyPool > 0) {
            bonusReward = penaltyPool / 10;
            if (bonusReward > refundAmount) {
                bonusReward = refundAmount; // Giới hạn bonus tối đa 100% tiền cọc
            }
            penaltyPool -= bonusReward;
        }

        session.isActive = false;
        session.isClaimed = true;

        uint256 totalPayout = refundAmount + bonusReward;
        (bool success, ) = payable(msg.sender).call{value: totalPayout}("");
        require(success, "Payout transfer failed");

        emit RewardClaimed(msg.sender, refundAmount, bonusReward, feynmanScore);
    }

    /**
     * @notice Phạt cọc khi hết hạn mà sinh viên không hoàn thành mục tiêu
     * @dev Bất kỳ ai cũng có thể gọi hàm này sau khi deadline kết thúc (permissionless keeper)
     * @param student Địa chỉ ví của sinh viên vi phạm
     */
    function penalize(address student) external nonReentrant {
        StudySession storage session = userSessions[student];
        require(session.isActive, "No active session for student");
        require(!session.isClaimed, "Already claimed");
        require(block.timestamp > session.deadline, "Deadline has not passed yet");

        uint256 forfeited = session.stakedAmount;
        session.isActive = false;
        session.stakedAmount = 0;

        // Chuyển toàn bộ tiền cọc vào Quỹ phạt (Penalty Pool) để chia cho các bạn chăm chỉ
        penaltyPool += forfeited;

        emit Penalized(student, forfeited);
    }

    /**
     * @notice Doanh nghiệp/Nhà tài trợ nạp thêm quỹ học bổng cho sinh viên
     */
    function fundBountyPool() external payable {
        require(msg.value > 0, "Funding amount must be > 0");
        penaltyPool += msg.value;
        emit BountyFunded(msg.sender, msg.value);
    }

    /**
     * @notice Cập nhật ví ký Oracle (chỉ Owner)
     */
    function setOracleSigner(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Zero address");
        emit OracleUpdated(oracleSigner, _newOracle);
        oracleSigner = _newOracle;
    }

    // Nhận AVAX trực tiếp
    receive() external payable {
        penaltyPool += msg.value;
    }
}
