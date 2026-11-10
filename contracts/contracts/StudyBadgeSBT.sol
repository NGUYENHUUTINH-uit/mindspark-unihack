// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title StudyBadgeSBT
 * @notice Thẻ sinh viên số Soulbound NFT động (Dynamic SBT) trên Avalanche Fuji
 * @dev Tuân thủ chuẩn ERC-721 với các đặc tính:
 * 1. Soulbound: Vô hiệu hóa 100% chức năng chuyển nhượng token (Non-transferable).
 * 2. Dynamic On-Chain Metadata & SVG: Tự động nâng cấp Level (1 -> 5) và đổi màu huy hiệu theo giờ học thực tế.
 * 3. Tự sinh toàn bộ JSON & SVG On-Chain không phụ thuộc máy chủ Web2 lưu trữ.
 */
contract StudyBadgeSBT is ERC721, Ownable {
    using Strings for uint256;

    uint256 private _nextTokenId = 1;

    struct BadgeMetrics {
        uint8 level;            // Cấp độ từ 1 đến 5
        uint32 totalMinutes;    // Tổng số phút học tập trung tích lũy
        uint32 totalSessions;   // Tổng số phiên hoàn thành
        uint16 feynmanAvgScore; // Điểm phản tư Feynman trung bình (1 - 100)
        uint32 lastUpdated;     // Thời điểm cập nhật cuối
    }

    // Mapping: Địa chỉ sinh viên => Token ID (mỗi sinh viên chỉ sở hữu 1 Badge duy nhất)
    mapping(address => uint256) public studentToBadgeId;

    // Mapping: Token ID => Chỉ số năng lực
    mapping(uint256 => BadgeMetrics) public badgeMetrics;

    // Danh sách các hợp đồng/địa chỉ được ủy quyền cập nhật năng lực
    mapping(address => bool) public authorizedCallers;

    // Events
    event BadgeMinted(address indexed student, uint256 indexed tokenId, uint8 initialLevel);
    event BadgeLevelUp(address indexed student, uint256 indexed tokenId, uint8 oldLevel, uint8 newLevel, uint32 totalMinutes);
    event AuthorizedCallerUpdated(address indexed caller, bool isAuthorized);

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Caller is not authorized");
        _;
    }

    constructor() ERC721("MindSpark Scholar Badge", "MSSBT") Ownable(msg.sender) {
        authorizedCallers[msg.sender] = true;
    }

    // =========================================================================
    // 1. TÍNH NĂNG SOULBOUND: VÔ HIỆU HÓA CHUYỂN NHƯỢNG TOKEN
    // =========================================================================

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Nếu from != 0 và to != 0 -> Đây là hành vi chuyển nhượng (Transfer) -> REVERT NGAY LẬP TỨC!
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: Token is permanently bound to this wallet and cannot be transferred");
        }

        return super._update(to, tokenId, auth);
    }

    // =========================================================================
    // 2. MINT & CẬP NHẬT TIẾN ĐỘ HỌC TẬP (DYNAMIC LEVEL-UP)
    // =========================================================================

    function mintBadge(address student) public onlyAuthorized returns (uint256) {
        require(student != address(0), "Cannot mint to zero address");
        require(studentToBadgeId[student] == 0, "Student already owns a MindSpark Badge");

        uint256 tokenId = _nextTokenId++;
        _safeMint(student, tokenId);

        studentToBadgeId[student] = tokenId;
        badgeMetrics[tokenId] = BadgeMetrics({
            level: 1,
            totalMinutes: 0,
            totalSessions: 0,
            feynmanAvgScore: 100,
            lastUpdated: uint32(block.timestamp)
        });

        emit BadgeMinted(student, tokenId, 1);
        return tokenId;
    }

    function recordStudyProgress(
        address student,
        uint256 sessionMinutes,
        uint256 feynmanScore
    ) external onlyAuthorized returns (uint8 newLevel) {
        uint256 tokenId = studentToBadgeId[student];

        if (tokenId == 0) {
            tokenId = mintBadge(student);
        }

        BadgeMetrics storage metrics = badgeMetrics[tokenId];

        uint32 currentSessions = metrics.totalSessions;
        uint256 totalScore = (uint256(metrics.feynmanAvgScore) * currentSessions) + feynmanScore;
        metrics.totalSessions = currentSessions + 1;
        metrics.feynmanAvgScore = uint16(totalScore / (currentSessions + 1));
        metrics.totalMinutes += uint32(sessionMinutes);
        metrics.lastUpdated = uint32(block.timestamp);

        uint8 oldLevel = metrics.level;
        newLevel = _calculateLevel(metrics.totalMinutes, metrics.feynmanAvgScore);

        if (newLevel > oldLevel) {
            metrics.level = newLevel;
            emit BadgeLevelUp(student, tokenId, oldLevel, newLevel, metrics.totalMinutes);
        }

        return newLevel;
    }

    function _calculateLevel(uint32 totalMinutes, uint16 feynmanScore) internal pure returns (uint8) {
        if (totalMinutes >= 3000 && feynmanScore >= 80) return 5;
        if (totalMinutes >= 1800) return 4;
        if (totalMinutes >= 900) return 3;
        if (totalMinutes >= 300) return 2;
        return 1;
    }

    // =========================================================================
    // 3. ON-CHAIN METADATA & DYNAMIC SVG GENERATION
    // =========================================================================

    function getLevelTitle(uint8 level) public pure returns (string memory) {
        if (level == 5) return "Grandmaster Scholar";
        if (level == 4) return "Cognitive Master";
        if (level == 3) return "Avalanche Scholar";
        if (level == 2) return "Disciplined Learner";
        return "Novice Scholar";
    }

    function getLevelColor(uint8 level) public pure returns (string memory) {
        if (level == 5) return "#FFD700"; // Vàng Hoàng Gia
        if (level == 4) return "#00F5FF"; // Xanh Cyan Tương Lai
        if (level == 3) return "#E84142"; // Đỏ Avalanche Chính Tông
        if (level == 2) return "#C0C0C0"; // Bạc Tinh Khiết
        return "#CD7F32"; // Đồng Cổ Điển
    }

    function _buildSvgTop(string memory color, uint8 level, string memory title) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="100%" height="100%">'
                '<rect width="400" height="500" rx="24" fill="#0f172a" stroke="', color, '" stroke-width="4"/>'
                '<circle cx="200" cy="140" r="60" fill="none" stroke="', color, '" stroke-width="6" stroke-dasharray="8,6"/>'
                '<text x="200" y="145" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#ffffff">LVL ', uint256(level).toString(), '</text>'
                '<text x="200" y="170" text-anchor="middle" font-family="Arial" font-size="11" fill="', color, '">AVALANCHE FUJI</text>'
                '<text x="200" y="245" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" fill="#ffffff">', title, '</text>'
                '<text x="200" y="270" text-anchor="middle" font-family="Arial" font-size="12" fill="#94a3b8">MindSpark Proof of Cognitive Effort</text>'
            )
        );
    }

    function _buildSvgBottom(string memory color, uint32 totalMinutes, uint16 score, uint32 sessions) internal pure returns (string memory) {
        uint256 hoursCount = uint256(totalMinutes) / 60;
        uint256 minsRemainder = uint256(totalMinutes) % 60;

        return string(
            abi.encodePacked(
                '<rect x="40" y="300" width="320" height="130" rx="16" fill="#0b0f19" stroke="#334155" stroke-width="1"/>'
                '<text x="60" y="340" font-family="Arial" font-size="13" fill="#94a3b8">Total Study Time:</text>'
                '<text x="340" y="340" text-anchor="end" font-family="Arial" font-size="14" font-weight="bold" fill="#ffffff">', hoursCount.toString(), 'h ', minsRemainder.toString(), 'm</text>'
                '<text x="60" y="375" font-family="Arial" font-size="13" fill="#94a3b8">Feynman Avg Score:</text>'
                '<text x="340" y="375" text-anchor="end" font-family="Arial" font-size="14" font-weight="bold" fill="', color, '">', uint256(score).toString(), '/100</text>'
                '<text x="60" y="410" font-family="Arial" font-size="13" fill="#94a3b8">Sessions Completed:</text>'
                '<text x="340" y="410" text-anchor="end" font-family="Arial" font-size="14" font-weight="bold" fill="#ffffff">', uint256(sessions).toString(), ' sessions</text>'
                '</svg>'
            )
        );
    }

    function renderSvg(uint256 tokenId) public view returns (string memory) {
        BadgeMetrics memory m = badgeMetrics[tokenId];
        string memory title = getLevelTitle(m.level);
        string memory color = getLevelColor(m.level);

        return string(
            abi.encodePacked(
                _buildSvgTop(color, m.level, title),
                _buildSvgBottom(color, m.totalMinutes, m.feynmanAvgScore, m.totalSessions)
            )
        );
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        BadgeMetrics memory m = badgeMetrics[tokenId];
        string memory title = getLevelTitle(m.level);
        string memory svg = renderSvg(tokenId);
        string memory imageUri = string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));

        bytes memory json = abi.encodePacked(
            '{"name": "MindSpark Scholar Badge #', tokenId.toString(), ': ', title, '",',
            '"description": "Soulbound Proof of Cognitive Effort Badge on Avalanche Fuji for student achievements.",',
            '"image": "', imageUri, '",',
            '"attributes": [',
                '{"trait_type": "Level", "value": ', uint256(m.level).toString(), '},',
                '{"trait_type": "Title", "value": "', title, '"},',
                '{"trait_type": "Total Minutes", "value": ', uint256(m.totalMinutes).toString(), '},',
                '{"trait_type": "Feynman Avg Score", "value": ', uint256(m.feynmanAvgScore).toString(), '},',
                '{"trait_type": "Completed Sessions", "value": ', uint256(m.totalSessions).toString(), '}',
            ']}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function setAuthorizedCaller(address caller, bool isAuthorized) external onlyOwner {
        require(caller != address(0), "Zero address");
        authorizedCallers[caller] = isAuthorized;
        emit AuthorizedCallerUpdated(caller, isAuthorized);
    }
}
