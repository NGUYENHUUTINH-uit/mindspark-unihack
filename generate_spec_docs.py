import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os
import subprocess

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_document():
    doc = docx.Document()
    
    # Page setup
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # Styles
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
    normal_style.paragraph_format.line_spacing = 1.18
    normal_style.paragraph_format.space_after = Pt(4)

    # Header title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    title_run = title_p.add_run("TÀI LIỆU ĐẶC TẢ YÊU CẦU ĐỀ TÀI")
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0xE8, 0x41, 0x42) # Avalanche Red

    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_after = Pt(14)
    sub_run = sub_p.add_run("DỰ ÁN: MINDSPARK - AI-POWERED PROOF OF COGNITIVE EFFORT & AUTONOMOUS STUDY-TO-EARN ON AVALANCHE")
    sub_run.font.size = Pt(12)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    # Info card table
    meta_table = doc.add_table(rows=5, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Cuộc thi:", "UniHack 2026 - The 30-day Journey (Greenwich Vietnam & Avalanche)"),
        ("Track dự thi:", "Social Finance kết hợp AI Agents & Security và Agent Economy on x402"),
        ("Nền tảng Blockchain:", "Avalanche (C-Chain / Custom L1 & Avalanche Interchain Messaging - ICM)"),
        ("Công nghệ chủ chốt:", "Next.js, MediaPipe Pose (Edge-AI), Whisper & LLM Agent, x402 Micropayments, Solidity"),
        ("Hạn nộp sản phẩm:", "23:59 - Thứ 7, ngày 21/11/2026 (Giờ Việt Nam)")
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells[0], row.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.7)
        set_cell_background(c0, "F5F5F7")
        set_cell_background(c1, "FAFAFA")
        set_cell_margins(c0, 60, 60, 100, 100)
        set_cell_margins(c1, 60, 60, 100, 100)
        p0 = c0.paragraphs[0]
        r0 = p0.add_run(k)
        r0.bold = True
        r0.font.size = Pt(10)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(v)
        r1.font.size = Pt(10)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    def add_h1(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.size = Pt(14)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xE8, 0x41, 0x42)
        return p

    def add_h2(text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        r = p.add_run(text)
        r.font.size = Pt(12)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
        return p

    # Section 1
    add_h1("1. TỔNG QUAN BÀI TOÁN & GIÁI PHÁP ĐỘT PHÁ")
    add_h2("1.1. Bối cảnh & Vấn đề thực tế (Problem Statement)")
    p = doc.add_paragraph(
        "• Kỷ luật tự học thấp: Sinh viên học tại nhà qua sách in hoặc nghe giảng online rất dễ xao nhãng bởi mạng xã hội, "
        "đặc biệt là thói quen vô thức cầm smartphone lướt TikTok/Facebook/Reels.\n"
        "• Thiếu tính xác thực trong Web3 Edu: Các dự án Study-to-Earn hoặc Pomodoro on-chain trước đây chỉ bấm giờ thụ động "
        "hoặc ép người dùng nhìn chằm chằm vào màn hình/file PDF. Điều này xa rời thực tế (khi sinh viên cần cúi xuống ghi chép, "
        "làm bài tập viết tay, đọc giáo trình in) và rất dễ bị gian lận bằng cách 'treo máy'.\n"
        "• Học vẹt, thiếu phản tư: Người học đọc sách nhiều giờ nhưng không đọng lại kiến thức vì thiếu cơ chế kiểm chứng mức độ tiếp thu."
    )

    add_h2("1.2. Giá trị cốt lõi & Giải pháp đột phá (Value Proposition)")
    p = doc.add_paragraph(
        "MindSpark là nền tảng học tập Web3 thế hệ mới giải quyết triệt để các vấn đề trên nhờ 3 trụ cột sáng tạo:\n"
        "1. Nhận diện tư thế học tập tự nhiên (Study Pose & Phone Distraction Detection): Ứng dụng Computer Vision (MediaPipe Pose) "
        "cho phép người học cúi đầu viết bài, đọc sách thoải mái. Hệ thống chỉ cảnh báo hoặc dừng đếm giờ khi phát hiện người dùng cầm điện thoại lướt hoặc ngủ gục.\n"
        "2. Phản tư kiến thức 30 giây theo phương pháp Feynman (Voice Reflection): Cuối mỗi phiên Pomodoro, sinh viên nói 30 giây tóm tắt "
        "điều mình vừa học. AI Agent phân tích ngữ nghĩa, đánh giá tiếp thu và tự động tạo thẻ Flashcard ôn tập cá nhân.\n"
        "3. Nền kinh tế học tập minh bạch trên Avalanche: Hợp đồng thông minh quản lý cọc cam kết (StudyStakeVault), stream tiền thưởng vi mô "
        "theo phút qua chuẩn HTTP 402 (x402 Micropayment), và cấp chứng chỉ năng lực on-chain động (Dynamic Soulbound NFT)."
    )

    # Section 2
    add_h1("2. KỊCH BẢN TRẢI NGHIỆM NGƯỜI DÙNG (USER JOURNEY)")
    p = doc.add_paragraph(
        "Quy trình sử dụng MindSpark diễn ra tự nhiên, không gây ức chế cho người học:"
    )
    steps = [
        ("Bước 1: Cam kết mục tiêu (Stake)", "Sinh viên kết nối ví Core/MetaMask trên mạng Avalanche, chọn thử thách (ví dụ: 'Học 15 giờ/tuần') và đặt cọc 10 USDC vào StudyStakeVault."),
        ("Bước 2: Học tập tự nhiên với AI", "Sinh viên mở Web App, đặt camera trước bàn học và bắt đầu phiên Pomodoro 45 phút. Sinh viên tự do đọc sách in, ghi chép vở bài tập. Nếu với tay lướt smartphone >60s, AI phát chuông nhắc nhở."),
        ("Bước 3: Phản tư Feynman 30 giây", "Hết phiên học, màn hình hiện nút mic. Sinh viên nói tóm tắt nhanh những gì vừa học trong 30-60 giây. AI Agent nghe, chấm điểm tiếp thu, tự động sinh Flashcard và ký chứng chỉ mật mã Proof of Cognitive Effort."),
        ("Bước 4: Nhận thưởng on-chain", "Dòng tiền vi thanh toán x402 stream trực tiếp về ví. Thẻ Soulbound NFT tăng điểm kinh nghiệm (EXP). Cuối tuần, sinh viên nhận lại 100% tiền cọc và chia thêm tiền thưởng từ quỹ vi phạm.")
    ]
    for s_title, s_desc in steps:
        p_step = doc.add_paragraph()
        r_st = p_step.add_run(f"• {s_title}: ")
        r_st.bold = True
        p_step.add_run(s_desc)

    # Section 3
    add_h1("3. ĐẶC TẢ YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)")
    add_h2("Module 1: AI Study Pose & Distraction Tracker (Giám sát tư thế)")
    p = doc.add_paragraph(
        "• FR-1.1 (Phân loại tư thế học tập): Sử dụng MediaPipe Pose chạy trực tiếp trên trình duyệt (WebAssembly) nhận diện các tư thế hợp lệ: "
        "Writing Pose (cúi đầu viết trên bàn), Reading Pose (mắt hướng xuống sách, tay lật trang), Screen Focus (nhìn màn hình nghe giảng).\n"
        "• FR-1.2 (Chống phân tâm điện thoại): Phát hiện cử chỉ tay cầm smartphone giơ trước mặt. Nếu duy trì quá 60 giây, hệ thống rung chuông cảnh báo và ngưng tính giờ.\n"
        "• FR-1.3 (Phát hiện vắng mặt / ngủ gục): Nếu người học rời bàn hoặc gục đầu xuống bàn quá 3 phút, phiên học tự động bị tạm dừng/hủy bỏ.\n"
        "• FR-1.4 (Quyền riêng tư tuyệt đối - Edge AI): 100% hình ảnh webcam được tính toán cục bộ trên RAM máy khách, không lưu trữ và không gửi bất kỳ khung hình nào lên server."
    )

    add_h2("Module 2: Feynman Voice Reflection & AI Learning Buddy (Phản tư âm thanh)")
    p = doc.add_paragraph(
        "• FR-2.1 (Thu âm phản tư 30 giây): Kết thúc phiên Pomodoro, giao diện kích hoạt tính năng thu âm nhanh 30 - 60 giây.\n"
        "• FR-2.2 (Speech-to-Text & Chấm điểm ngữ nghĩa): Bộ chuyển đổi Whisper API chuyển giọng nói thành văn bản. LLM Agent (Gemini/Llama) "
        "đánh giá tính mạch lạc và ý nghĩa tri thức của câu trả lời, loại bỏ trường hợp nói nhảm hoặc đọc lại bảng chữ cái.\n"
        "• FR-2.3 (Tự sinh Flashcard ôn tập): Trích xuất khái niệm cốt lõi thành 1 Flashcard định dạng Q&A, lưu vào Sổ tay học tập số.\n"
        "• FR-2.4 (Ký phát hành Proof of Cognitive Effort): Backend Oracle ký một EIP-712 Signature xác nhận tính hợp lệ của phiên học."
    )

    add_h2("Module 3: Avalanche Smart Contracts & Staking Vault")
    p = doc.add_paragraph(
        "• FR-3.1 (StudyStakeVault.sol): Quản lý nạp/rút cọc USDC trên mạng Avalanche Fuji Testnet, tự động giải ngân khi đạt KPI tuần.\n"
        "• FR-3.2 (Penalty Redistribution): Thu tiền phạt của các thành viên bỏ cuộc giữa chừng và phân phối lại cho các thành viên xuất sắc nhất.\n"
        "• FR-3.3 (Yield Float Optimization): Số tiền cọc nhàn rỗi trong tuần được đưa vào giao thức sinh lãi (mocking Benqi/Aave) để tạo thêm lợi nhuận cho người học."
    )

    add_h2("Module 4: Chuẩn thanh toán x402 & Dynamic Soulbound NFT")
    p = doc.add_paragraph(
        "• FR-4.1 (x402 Micropayment Rails): Tích hợp chuẩn HTTP 402 Payment Required cho phép doanh nghiệp tài trợ stream học bổng vi mô theo từng phút học tập trung.\n"
        "• FR-4.2 (Dynamic Soulbound NFT - Skill Tree): Mint thẻ kỹ năng on-chain không thể chuyển nhượng (ERC-721/1155). Metadata tự động nâng cấp level theo số giờ học tích lũy.\n"
        "• FR-4.3 (Reward Marketplace): Cho phép đổi điểm danh vọng on-chain lấy voucher khóa học, quà tặng từ nhà tài trợ."
    )

    # Section 4
    add_h1("4. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ (SYSTEM ARCHITECTURE)")
    arch_table = doc.add_table(rows=4, cols=3)
    arch_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Tầng kiến trúc", "Công nghệ sử dụng", "Vai trò và nhiệm vụ chính"]
    for j, h in enumerate(headers):
        cell = arch_table.rows[0].cells[j]
        set_cell_background(cell, "E84142")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    arch_data = [
        ("Client (Frontend)", "Next.js, Tailwind CSS, MediaPipe Pose, Web Audio API, viem/wagmi", "Giao diện Pomodoro, phân tích tư thế học cục bộ, ghi âm Feynman, kết nối ví Core"),
        ("Backend & AI Services", "FastAPI (Python), OpenAI Whisper, LLM Agent, Web3.py", "Chuyển giọng nói thành text, chấm điểm Feynman, tạo Flashcard, ký EIP-712 Signature"),
        ("Blockchain (Avalanche)", "Solidity, Avalanche Fuji Testnet, x402 Protocol, ERC-721/1155", "Hợp đồng nạp cọc StudyStakeVault, vi thanh toán stream x402, thẻ kỹ năng Dynamic SBT")
    ]
    for i, row_data in enumerate(arch_data):
        row = arch_table.rows[i+1]
        for j, text in enumerate(row_data):
            cell = row.cells[j]
            bg = "FAFAFA" if i % 2 == 0 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.size = Pt(9.5)

    # Section 5
    add_h1("5. ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)")
    p = doc.add_paragraph(
        "• Bảo mật & Quyền riêng tư: Không tải luồng video của sinh viên lên máy chủ; xử lý 100% tại Client qua WebAssembly.\n"
        "• Độ trễ phản hồi: Sau khi kết thúc 30 giây ghi âm Feynman, AI hoàn tất phân tích và tạo Flashcard trong vòng dưới 5 giây.\n"
        "• Hiệu năng máy khách: Thư viện MediaPipe Pose tối ưu hóa để mức chiếm dụng CPU không vượt quá 15-20% trên laptop thông thường.\n"
        "• Tối ưu phí Gas: Cơ chế gộp phiên học bằng chữ ký EIP-712 giúp sinh viên chỉ tốn 1 giao dịch claim vào cuối tuần."
    )

    # Section 6
    add_h1("6. KẾ HOẠCH TRIỂN KHAI 3 TUẦN (ROADMAP TO 21/11)")
    road_table = doc.add_table(rows=4, cols=3)
    road_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    r_headers = ["Giai đoạn", "Thời gian", "Nhiệm vụ & Sản phẩm bàn giao (Deliverables)"]
    for j, h in enumerate(r_headers):
        cell = road_table.rows[0].cells[j]
        set_cell_background(cell, "1F2937")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    road_data = [
        ("Tuần 1: Nền tảng", "02/11 - 08/11", "Viết và test Smart Contract StudyStakeVault.sol trên Avalanche Fuji. Dựng khung UI Pomodoro kết nối ví."),
        ("Tuần 2: Tích hợp AI", "09/11 - 15/11", "Tích hợp MediaPipe Pose phát hiện tư thế & cảnh báo điện thoại. Hoàn thiện luồng thu âm 30s + LLM tạo Flashcard. Ký Oracle Proof."),
        ("Tuần 3: Hoàn thiện & Nộp bài", "16/11 - 21/11", "Tích hợp chuẩn x402 / Dynamic SBT. Tinh chỉnh UI/UX, quay video demo 3 phút, làm slide pitch. Nộp bài trước 23:59 ngày 21/11.")
    ]
    for i, row_data in enumerate(road_data):
        row = road_table.rows[i+1]
        for j, text in enumerate(row_data):
            cell = row.cells[j]
            bg = "FAFAFA" if i % 2 == 0 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.size = Pt(9.5)

    # Section 7
    add_h1("7. BẢNG ĐỐI CHIẾU THANG ĐIỂM 100 CỦA UNIHACK")
    score_table = doc.add_table(rows=7, cols=3)
    score_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    s_headers = ["Tiêu chí đánh giá", "Trọng số", "Cách dự án MindSpark tối ưu điểm số"]
    for j, h in enumerate(s_headers):
        cell = score_table.rows[0].cells[j]
        set_cell_background(cell, "E84142")
        set_cell_margins(cell, 80, 80, 100, 100)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    score_data = [
        ("Technical Implementation", "25 điểm", "Full-stack hoàn chỉnh: Frontend Next.js + Edge AI (MediaPipe) + AI Agent (Whisper/LLM) + Backend API."),
        ("Avalanche Integration", "25 điểm", "Smart Contract trên Avalanche Fuji, chuẩn x402 Micropayment, tích hợp ví Core Native, Yield Float."),
        ("Creativity & Innovation", "15 điểm", "Đổi mới vượt bậc: Học bằng tư thế tự nhiên + phương pháp phản tư Feynman 30s + AI tự sinh Flashcard."),
        ("Impact & Use Case", "15 điểm", "Giải quyết bài toán kỷ luật học tập thật cho hàng triệu sinh viên; kết nối học bổng doanh nghiệp minh bạch."),
        ("UI/UX & Live Demo", "10 điểm", "Giao diện hiện đại, chuông học sinh động; kịch bản demo trực tiếp mượt mà từ âm thanh đến giao dịch on-chain."),
        ("Presentation & Pitching", "10 điểm", "Cấu trúc thuyết trình chặt chẽ: Vấn đề nhức nhối -> Lỗ hổng app cũ -> Đột phá của MindSpark -> Live Demo.")
    ]
    for i, row_data in enumerate(score_data):
        row = score_table.rows[i+1]
        for j, text in enumerate(row_data):
            cell = row.cells[j]
            bg = "FAFAFA" if i % 2 == 0 else "FFFFFF"
            set_cell_background(cell, bg)
            set_cell_margins(cell, 60, 60, 100, 100)
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.size = Pt(9.5)

    docx_path = r"c:\UIT\UniHack\MindSpark_Project_Specification.docx"
    doc.save(docx_path)
    print(f"Saved DOCX to: {docx_path}")
    return docx_path

if __name__ == "__main__":
    create_document()
