import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import subprocess

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_plan_document():
    doc = docx.Document()
    
    # Page setup - Margins
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Base style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(10.5)
    normal_style.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
    normal_style.paragraph_format.line_spacing = 1.15
    normal_style.paragraph_format.space_after = Pt(3)

    # Title
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(0)
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("KẾ HOẠCH TRIỂN KHAI & PHÂN CÔNG NHIỆM VỤ")
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(0xE8, 0x41, 0x42) # Avalanche Red

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("DỰ ÁN: MINDSPARK | ĐỘI HÌNH 3 THÀNH VIÊN | DEADLINE: 19/11/2026")
    r_sub.font.size = Pt(11)
    r_sub.font.bold = True
    r_sub.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    # Overview table
    meta_table = doc.add_table(rows=5, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Mục tiêu chiến lược:", "Hoàn thiện 100% MVP, kiểm thử Testnet, quay video demo và slide vào 19/11/2026 (trước hạn thi chính thức 2 ngày)."),
        ("Quy mô nhân sự:", "3 thành viên chuyên trách: 1 Blockchain & Backend + 1 AI & Computer Vision + 1 Frontend & Pitch Lead."),
        ("Khung quy trình:", "Agile / Scrum gồm 4 Sprints liên tục, quản lý tập trung qua hệ thống Jira."),
        ("Nền tảng công nghệ:", "Avalanche Fuji Testnet, Solidity, Next.js, MediaPipe Pose (Edge-AI), Whisper & LLM, x402 Micropayments."),
        ("Mốc nộp bài UniHack:", "Chính thức: 23:59 ngày 21/11/2026 | Deadline nội bộ nhóm: 23:59 ngày 19/11/2026.")
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.8)
        set_cell_background(c0, "F5F5F7")
        set_cell_background(c1, "FAFAFA")
        set_cell_margins(c0, 50, 50, 80, 80)
        set_cell_margins(c1, 50, 50, 80, 80)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.size = Pt(9.5)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(v)
        r1.font.size = Pt(9.5)

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xE8, 0x41, 0x42)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.size = Pt(11)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
        return p

    # Section 1
    add_h1("I. ĐẶC TẢ VAI TRÒ & NĂNG LỰC CỦA 3 THÀNH VIÊN")
    roles = [
        ("Thành viên 1: Blockchain & Backend Infrastructure (Tech Lead)",
         "• Lĩnh vực: Web3, Solidity Smart Contracts, Avalanche C-Chain / Fuji Testnet, EIP-712 Signing, x402 Micropayment Protocol, FastAPI/Web3.py.\n"
         "• Trọng tâm công việc: Đảm nhiệm hoàn toàn phần 25 điểm 'Avalanche Integration' và logic tài chính on-chain (cọc, phạt, chia thưởng, stream tiền theo phút qua x402, mint Soulbound NFT)."),
        ("Thành viên 2: AI & Computer Vision Specialist (Edge-AI Lead)",
         "• Lĩnh vực: Computer Vision, MediaPipe Pose (WebAssembly), Audio Engineering (Web Audio API), Speech-to-Text (Whisper), Prompt Engineering (LLM).\n"
         "• Trọng tâm công việc: Xây dựng thuật toán nhận diện tư thế viết/đọc sách tự nhiên, phát hiện phân tâm smartphone, và bộ máy phân tích giọng nói Feynman 30s tự sinh Flashcard."),
        ("Thành viên 3: Frontend Web3 UI/UX & Product/Pitch Lead",
         "• Lĩnh vực: Next.js (App Router), Tailwind CSS, Wagmi/Viem (kết nối ví Core Wallet/MetaMask), UI/UX Motion, Video Editing, Pitch Deck Design.\n"
         "• Trọng tâm công việc: Tích hợp toàn bộ hệ thống vào giao diện web hoàn chỉnh, đảm bảo 10 điểm UI/UX, sản xuất video demo 3 phút và slide thuyết trình chung kết ăn trọn 10 điểm Pitching.")
    ]
    for r_title, r_desc in roles:
        add_h2(r_title)
        doc.add_paragraph(r_desc)

    # Section 2
    add_h1("II. LỘ TRÌNH 4 SPRINT CHI TIẾT (03/11 - 19/11)")
    sprint_table = doc.add_table(rows=5, cols=4)
    sprint_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    s_headers = ["Sprint", "Thời gian", "Mục tiêu trọng tâm", "Tiêu chí hoàn thành (Acceptance Criteria)"]
    for j, h in enumerate(s_headers):
        cell = sprint_table.rows[0].cells[j]
        set_cell_background(cell, "E84142")
        set_cell_margins(cell, 60, 60, 80, 80)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    sprints_info = [
        ("Sprint 1: Nền tảng", "03/11 - 07/11 (5 ngày)", "Xây dựng các module cốt lõi độc lập", "Smart contract cọc tiền test pass trên local; Prototype MediaPipe nhận diện được tư thế cúi viết; Giao diện web kết nối được ví Avalanche Fuji."),
        ("Sprint 2: Tích hợp AI", "08/11 - 13/11 (6 ngày)", "Ghép AI vào giao diện & Xác thực Oracle", "Camera và micro chạy mượt trên web Next.js; Backend chấm điểm Feynman 30s trả ra Flashcard; Ký thành công chữ ký EIP-712 nạp lên contract."),
        ("Sprint 3: Hoàn thiện", "14/11 - 17/11 (4 ngày)", "Kinh tế x402, Soulbound NFT & Gamification", "Hợp đồng StudyBadgeSBT nâng cấp level tự động; Endpoint x402 stream trả thưởng vi mô; Giao diện Sổ tay Flashcard và Cây kỹ năng hoàn tất."),
        ("Sprint 4: Đóng gói", "18/11 - 19/11 (2 ngày)", "Tổng duyệt, Quay Demo & Slide Pitching", "Dry-run 5 lần chu trình hoàn hảo không lỗi; Video demo 3 phút Full HD có tiếng thật; Bộ slide 12 trang sắc sảo; Repo GitHub sẵn sàng.")
    ]
    for i, row_data in enumerate(sprints_info):
        row = sprint_table.rows[i+1]
        for j, text in enumerate(row_data):
            cell = row.cells[j]
            bg = "FAFAFA" if i % 2 == 0 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 50, 50, 80, 80)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.size = Pt(8.8)

    # Section 3
    add_h1("III. BẢN HƯỚNG DẪN THỰC THI CHI TIẾT TỪNG NHIỆM VỤ")
    
    add_h2("1. Hướng dẫn cho Thành viên 1 (Blockchain & Backend)")
    p = doc.add_paragraph(
        "• Thiết lập Testnet: Truy cập faucet.avax.network lấy AVAX testnet mạng Fuji. Sử dụng Hardhat kết nối RPC: https://api.avax-test.network/ext/bc/C/rpc.\n"
        "• StudyStakeVault.sol: Thiết kế mapping(address => UserInfo) lưu trữ: depositAmount, targetHours, completedMinutes, lastTimestamp. Viết hàm stake() nhận USDC testnet. Hàm claimReward() sử dụng ECDSA.recover(messageHash, signature) để đảm bảo chỉ giải ngân khi có chữ ký Oracle hợp lệ.\n"
        "• Chuẩn x402 Micropayment: Dựng endpoint API yêu cầu header HTTP 402 Payment Required. Khi sinh viên học đủ 1 phút hợp lệ, hợp đồng tự động ghi nhận lượng vi thanh toán (micro-payout) tích lũy.\n"
        "• StudyBadgeSBT.sol: Kế thừa ERC-721 URI Storage, ghi đè hàm _beforeTokenTransfer() để chặn mọi giao dịch chuyển nhượng (Soulbound)."
    )

    add_h2("2. Hướng dẫn cho Thành viên 2 (AI & Computer Vision)")
    p = doc.add_paragraph(
        "• Nhận diện tư thế tự nhiên (MediaPipe Pose): Tải thư viện @mediapipe/pose chạy qua WebAssembly. Trích xuất tọa độ các mốc: Mũi (Nose), Hai vai (Left/Right Shoulder), Hai cổ tay (Left/Right Wrist). Khi góc cúi của đầu và vai hướng về phía mặt bàn và tay ở vị trí viết -> Xác nhận Writing Pose hợp lệ.\n"
        "• Phát hiện phân tâm điện thoại (Phone Distraction): Kiểm tra khoảng cách giữa cổ tay và mặt. Nếu cổ tay nâng cao ngang tầm mắt kèm ngón tay thao tác lướt -> Bật cờ cảnh báo. Duy trì > 60 giây -> Tạm dừng tính giờ.\n"
        "• Feynman Voice Evaluation: Sử dụng Web Audio API ghi âm file .wav độ dài 30 giây. Gửi về FastAPI backend, gọi OpenAI Whisper (hoặc Groq Whisper tốc độ cao 0.5s). Đưa transcript qua prompt LLM (Gemini 1.5 Flash): 'Đánh giá câu trả lời của sinh viên về tính mạch lạc và nội dung kiến thức tiếp thu, trả về JSON gồm điểm 1-10 và 1 Flashcard tóm tắt Q&A'.\n"
        "• Quyền riêng tư (Privacy): Khẳng định toàn bộ luồng video chạy trên RAM máy khách, không một frame hình nào được gửi lên server hay lưu trữ ổ cứng."
    )

    add_h2("3. Hướng dẫn cho Thành viên 3 (Frontend & Pitching Lead)")
    p = doc.add_paragraph(
        "• Giao diện Focus Room (Next.js): Tích hợp webcam và đồng hồ Pomodoro 45 phút vào cùng 1 màn hình. Có chỉ số Focus Index (%) hiển thị trực tiếp. Khi kết thúc phiên Pomodoro, tự động hiển thị nút bật Micro kèm sóng âm visualizer sinh động.\n"
        "• Web3 Wallet Hook: Cấu hình Wagmi với Avalanche Fuji. Sử dụng hook useAccount, useReadContract, useWriteContract để thực hiện cọc và nhận thưởng. Hiển thị thông báo Toast đẹp mắt kèm link xem giao dịch trên Snowtrace Explorer.\n"
        "• Sổ tay Flashcard & Cây kỹ năng: Thiết kế thẻ Flashcard có hiệu ứng lật 3D (flip animation). Thiết kế cây kỹ năng với các mốc Level 1 đến Level 5 mở khóa huy hiệu mới.\n"
        "• Kịch bản Video Demo 3 phút: Cấu trúc video gồm 4 phân đoạn: (1) Nêu vấn đề sinh viên xao nhãng vì điện thoại trong 30s; (2) Mở camera ngồi cúi viết bài, thử cầm điện thoại lên để máy báo chuông trong 45s; (3) Hết giờ bấm mic nói phản tư 30s, AI hiện ngay Flashcard trong 45s; (4) Xem giao dịch claim thưởng USDC và Soulbound NFT trên Avalanche Explorer trong 60s."
    )

    # Section 4
    add_h1("IV. NGUYÊN TẮC PHỐI HỢP & QUẢN TRỊ DỰ ÁN")
    p = doc.add_paragraph(
        "• Daily Standup 15 phút: Cả 3 thành viên họp nhanh vào 21:30 mỗi tối qua Discord/Google Meet trả lời 3 câu hỏi: Hôm nay đã làm xong task nào trên Jira? Ngày mai làm gì? Đang gặp khó khăn gì cần người khác hỗ trợ?\n"
        "• Git Workflow nghiêm ngặt: Nhánh main là nhánh sản phẩm chạy ổn định. Mỗi thành viên tạo nhánh riêng: feature/blockchain, feature/ai-pose, feature/frontend-ui. Mọi pull request phải được ít nhất 1 thành viên khác review trước khi merge.\n"
        "• Dự phòng rủi ro Testnet: Chuẩn bị sẵn 1 video quay sẵn toàn bộ luồng chạy trên local và testnet. Nếu ngày thuyết trình chung kết mạng testnet bị nghẽn gas, phát video demo dự phòng ngay lập tức để không bị mất điểm."
    )

    docx_path = r"c:\UIT\UniHack\MindSpark_Execution_Plan.docx"
    doc.save(docx_path)
    print(f"Saved DOCX plan to: {docx_path}")
    return docx_path

if __name__ == "__main__":
    create_plan_document()
