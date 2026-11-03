import csv

# Jira Cloud Standard CSV format with Issue ID, Parent ID, and seconds for Original Estimate
fields = [
    "Issue ID",
    "Parent ID",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
    "Assignee",
    "Due Date",
    "Original Estimate"
]

tasks = [
    # 4 EPICS (Issue ID: 1, 2, 3, 4)
    {
        "Issue ID": "1",
        "Parent ID": "",
        "Issue Type": "Epic",
        "Summary": "[EPIC 1] Smart Contracts & Avalanche Infrastructure",
        "Description": "Thiết kế, kiểm thử và triển khai các hợp đồng thông minh trên Avalanche Fuji Testnet cùng với chuẩn vi thanh toán x402 và Oracle Relayer.",
        "Priority": "High",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-17",
        "Original Estimate": "144000" # 40h in seconds
    },
    {
        "Issue ID": "2",
        "Parent ID": "",
        "Issue Type": "Epic",
        "Summary": "[EPIC 2] Edge-AI Computer Vision & Voice Reflection",
        "Description": "Xây dựng module AI thị giác máy tính nhận diện tư thế học/chống phân tâm điện thoại (MediaPipe) và module AI phân tích giọng nói Feynman tạo Flashcard (Whisper + LLM).",
        "Priority": "High",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-17",
        "Original Estimate": "144000" # 40h
    },
    {
        "Issue ID": "3",
        "Parent ID": "",
        "Issue Type": "Epic",
        "Summary": "[EPIC 3] Frontend Web Application & Web3 Integration",
        "Description": "Xây dựng giao diện Next.js, tích hợp ví Avalanche, kết nối camera/micro vào UI Pomodoro, hiển thị Flashcard và cây kỹ năng Dynamic SBT.",
        "Priority": "High",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-17",
        "Original Estimate": "144000" # 40h
    },
    {
        "Issue ID": "4",
        "Parent ID": "",
        "Issue Type": "Epic",
        "Summary": "[EPIC 4] End-to-End Integration, Demo & Pitch Deck",
        "Description": "Ghép nối toàn bộ luồng, kiểm thử thực tế trên Fuji Testnet, sản xuất video demo 3 phút và bộ slide pitching chung kết.",
        "Priority": "Highest",
        "Assignee": "All_Team",
        "Due Date": "2026-11-19",
        "Original Estimate": "86400" # 24h
    },

    # TASKS FOR EPIC 1 (Parent ID: 1)
    {
        "Issue ID": "5",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T1: Cấu hình Hardhat & Môi trường Avalanche Fuji Testnet",
        "Description": "Khởi tạo repo Hardhat/Foundry, thiết lập file hardhat.config.js kết nối RPC Avalanche Fuji (Chain ID 43113), cấu hình private key và lấy AVAX testnet từ Faucet.",
        "Priority": "High",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-04",
        "Original Estimate": "14400" # 4h
    },
    {
        "Issue ID": "6",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T2: Phát triển Smart Contract StudyStakeVault.sol (Cọc & Rút)",
        "Description": "Viết hợp đồng quản lý cọc USDC, hàm stake(), hàm phạt penalize() khi không đủ KPI tuần, và cấu trúc lưu trữ thông tin sinh viên.",
        "Priority": "High",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-06",
        "Original Estimate": "36000" # 10h
    },
    {
        "Issue ID": "7",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T3: Viết Unit Test và Deploy thử nghiệm StudyStakeVault lên Fuji",
        "Description": "Viết kịch bản test bằng Chai/Mocha hoặc Foundry, kiểm tra toàn bộ luồng nạp cọc, rút cọc, phạt. Deploy bản v1 lên Avalanche Fuji Testnet.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-07",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "8",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T4: Xây dựng cơ chế Oracle Ký xác thực EIP-712 Signature",
        "Description": "Viết dịch vụ backend ký cryptographic EIP-712 cho các phiên học hợp lệ. Cập nhật StudyStakeVault.sol hàm claimReward() xác minh chữ ký ecrecover.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-10",
        "Original Estimate": "36000" # 10h
    },
    {
        "Issue ID": "9",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T5: Nghiên cứu & Thiết kế Khung Chuẩn vi thanh toán x402 Rails",
        "Description": "Xây dựng Smart Contract và middleware HTTP 402 Payment Required cho phép doanh nghiệp stream trả thưởng vi mô per-minute về ví sinh viên.",
        "Priority": "High",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-13",
        "Original Estimate": "36000" # 10h
    },
    {
        "Issue ID": "10",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T6: Viết Smart Contract StudyBadgeSBT.sol (Soulbound NFT Động)",
        "Description": "Xây dựng chuẩn ERC-721/1155 không thể chuyển nhượng, metadata tự động thăng cấp Level (1-5) theo số giờ học tích lũy. Deploy lên Avalanche Fuji.",
        "Priority": "High",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-15",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "11",
        "Parent ID": "1",
        "Issue Type": "Task",
        "Summary": "M1-T7: Hoàn thiện API Middleware x402 Micropayment & Verify Contract",
        "Description": "Hoàn thiện luồng kiểm tra thanh toán chuẩn x402. Verify toàn bộ source code Solidity trên Snowtrace Explorer để phục vụ demo.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-17",
        "Original Estimate": "21600" # 6h
    },

    # TASKS FOR EPIC 2 (Parent ID: 2)
    {
        "Issue ID": "12",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T1: Xây dựng Prototype MediaPipe Pose nhận diện tư thế viết/đọc",
        "Description": "Tạo trang HTML/JS mẫu tích hợp @mediapipe/pose. Tính toán góc nghiêng đầu/vai/tay để phân biệt Writing Pose, Reading Pose và tư thế ngủ gục.",
        "Priority": "High",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-05",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "13",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T2: Thuật toán phát hiện phân tâm điện thoại (Phone Distraction)",
        "Description": "Nhận diện vị trí bàn tay đưa lên ngang mặt kèm tư thế cầm điện thoại. Ghi nhận thời gian, kích hoạt cờ cảnh báo nếu quá 60 giây.",
        "Priority": "High",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-06",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "14",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T3: Xây dựng FastAPI Backend chấm điểm Feynman & tạo Flashcard",
        "Description": "Dựng endpoint /api/feynman-evaluate nhận file âm thanh 30s. Gọi Whisper API chuyển voice thành text, dùng LLM chấm điểm ngữ nghĩa và trả về Flashcard JSON.",
        "Priority": "High",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-07",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "15",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T4: Đưa Model MediaPipe Pose chạy trực tiếp trong React Next.js",
        "Description": "Bọc MediaPipe Pose thành React Custom Hook (usePoseTracker). Tối ưu hóa hiệu năng để mức chiếm dụng CPU không quá 15% trên trình duyệt.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-10",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "16",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T5: Hoàn thiện Component Thu âm 30s & Visualizer sóng âm",
        "Description": "Tích hợp Web Audio API thu âm trực tiếp từ microphone sau khi kết thúc Pomodoro, hiển thị thanh sóng âm thanh và gửi audio lên API Feynman.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-12",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "17",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T6: Tinh chỉnh Prompt Feynman & Cơ chế Chống Fake Camera",
        "Description": "Bổ sung thuật toán kiểm tra chớp mắt (Blink detection) để ngăn dùng ảnh tĩnh. Tinh chỉnh prompt LLM để chấm điểm phân biệt đúng năng lực tiếp thu.",
        "Priority": "High",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-16",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "18",
        "Parent ID": "2",
        "Issue Type": "Task",
        "Summary": "M2-T7: Viết Tài liệu Giải trình Bảo mật Quyền riêng tư (Privacy Whitepaper)",
        "Description": "Soạn tài liệu tóm tắt 2 trang chứng minh hệ thống xử lý Edge-AI 100% trên client, không thu thập video người học, chuẩn bị trả lời BGK.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_2_AI",
        "Due Date": "2026-11-17",
        "Original Estimate": "14400" # 4h
    },

    # TASKS FOR EPIC 3 (Parent ID: 3)
    {
        "Issue ID": "19",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T1: Khởi tạo Project Next.js & Cấu hình Tailwind + Shadcn UI",
        "Description": "Tạo source code Next.js 14/15 App Router, cài đặt theme tối giản/hiện đại, cấu hình hệ thống font và các UI components cơ bản.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-04",
        "Original Estimate": "14400" # 4h
    },
    {
        "Issue ID": "20",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T2: Tích hợp Kết nối Ví Web3 (Avalanche Core Wallet / MetaMask)",
        "Description": "Dùng RainbowKit/AppKit + Wagmi/Viem để kết nối ví, tự động chuyển mạng sang Avalanche Fuji Testnet, hiển thị số dư AVAX & USDC.",
        "Priority": "High",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-05",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "21",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T3: Thiết kế Giao diện Pomodoro Focus Room & Dashboard",
        "Description": "Dựng màn hình học tập chính gồm đồng hồ đếm ngược Pomodoro 45 phút, khung hiển thị webcam, nút bật/tắt camera/mic, chuông cảnh báo âm thanh.",
        "Priority": "High",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-07",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "22",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T4: Kết nối Frontend với Smart Contract Vault (Stake & Claim)",
        "Description": "Viết hàm gọi Smart Contract bằng Wagmi (approve USDC, stake, claimReward). Xử lý trạng thái pending/success và hiển thị hash transaction lên Snowtrace.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-11",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "23",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T5: Xây dựng Màn hình Sổ tay Flashcard & Modal Kết quả",
        "Description": "Thiết kế component hiển thị danh sách thẻ Flashcard dạng lật 3D (Flip Card). Dựng modal hiển thị điểm Feynman và số tiền thưởng sau phiên học.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-13",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "24",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T6: Xây dựng Trang Cây kỹ năng (Skill Tree) & Đổi quà Gamification",
        "Description": "Thiết kế trang trực quan hóa tiến trình học tập của sinh viên, hiển thị huy hiệu Soulbound NFT và nút Claim phần thưởng/voucher nhà tài trợ.",
        "Priority": "High",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-15",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "25",
        "Parent ID": "3",
        "Issue Type": "Task",
        "Summary": "M3-T7: Tối ưu UI/UX, Hiệu ứng Âm thanh & Confetti",
        "Description": "Thêm hiệu ứng pháo hoa ăn mừng khi hoàn thành mục tiêu, âm thanh chuông Pomodoro, tối ưu giao diện trên màn hình laptop trình chiếu máy chiếu.",
        "Priority": "Medium",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-17",
        "Original Estimate": "14400" # 4h
    },

    # TASKS FOR EPIC 4 (Parent ID: 4)
    {
        "Issue ID": "26",
        "Parent ID": "4",
        "Issue Type": "Task",
        "Summary": "ALL-T1: Dry-Run Toàn hệ thống & Khắc phục lỗi Testnet (Bug Bash)",
        "Description": "Cả 3 thành viên chạy thử nghiệm 5 lần chu trình hoàn chỉnh từ nạp cọc -> mở cam học -> chuông cảnh báo phone -> thu âm Feynman -> claim tiền Fuji.",
        "Priority": "Highest",
        "Assignee": "All_Team",
        "Due Date": "2026-11-18",
        "Original Estimate": "28800" # 8h
    },
    {
        "Issue ID": "27",
        "Parent ID": "4",
        "Issue Type": "Task",
        "Summary": "ALL-T2: Quay & Dựng Video Live Demo 3 phút (Chất lượng Full HD)",
        "Description": "Quay màn hình demo thực tế: có tiếng nói thật khi làm Feynman 30s, có giao dịch hiển thị trên Avalanche Explorer. Xuất video gửi kèm bài nộp.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-19",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "28",
        "Parent ID": "4",
        "Issue Type": "Task",
        "Summary": "ALL-T3: Thiết kế Slide Pitching Thuyết trình Chung kết (10-12 Slides)",
        "Description": "Soạn slide pitch chuyên nghiệp theo cấu trúc: Problem -> Existing Flaws -> MindSpark Solution -> Tech Stack (Avalanche/x402/Edge-AI) -> Live Demo -> Roadmap.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_3_Frontend_Pitch",
        "Due Date": "2026-11-19",
        "Original Estimate": "21600" # 6h
    },
    {
        "Issue ID": "29",
        "Parent ID": "4",
        "Issue Type": "Task",
        "Summary": "ALL-T4: Hoàn thiện GitHub README.md & Đóng gói Hồ sơ Nộp bài",
        "Description": "Trình bày file README GitHub chuẩn chuyên nghiệp: Architecture Diagram, Hướng dẫn cài đặt, Danh sách Verified Smart Contracts, Video link. Đóng gói trước 23:59 ngày 19/11.",
        "Priority": "Highest",
        "Assignee": "ThanhVien_1_Blockchain",
        "Due Date": "2026-11-19",
        "Original Estimate": "14400" # 4h
    }
]

csv_file = r"c:\UIT\UniHack\jira_tasks_mindspark.csv"
with open(csv_file, mode="w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=fields)
    writer.writeheader()
    for task in tasks:
        writer.writerow(task)

print(f"Updated CSV with Issue ID, Parent ID, and seconds format for {len(tasks)} items.")
