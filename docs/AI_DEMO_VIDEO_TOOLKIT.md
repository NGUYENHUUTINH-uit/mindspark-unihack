# 🎬 BỘ CÔNG CỤ TẠO VIDEO DEMO AI HOÀN CHỈNH (LỒNG TIẾNG + VIETSUB CHUẨN 2:30)

Tài liệu này cung cấp đầy đủ **Lời thoại lồng tiếng AI**, **File phụ đề Vietsub (.srt)** và **Quy trình 3 bước** để bạn có ngay một video thuyết trình chuẩn Full HD nộp bài UniHack 2026 mà không sợ bị nói vấp hay lẫn tạp âm.

---

## 📌 PHẦN 1: FILE PHỤ ĐỀ VIETSUB ĐÃ TẠO SẴN
File phụ đề chuẩn đã được tạo tại: **[`docs/mindspark_demo_vietsub.srt`](mindspark_demo_vietsub.srt)**.
* Đã được chia thành **19 mốc thời gian (Timestamps)** chính xác từ giây thứ `00:00:00` đến `00:02:30`.
* Bạn chỉ cần kéo thả file này vào CapCut / Premiere là toàn bộ phụ đề Vietsub tự động hiển thị khớp với lời nói.

---

## 🎙️ PHẦN 2: LỜI THOẠI LỒNG TIẾNG AI (COPY-PASTE VÀO ELEVENLABS / VBEE / CAPCUT)

Bạn có thể copy toàn bộ đoạn văn bản dưới đây vào bất kỳ công cụ AI Text-to-Speech nào (khuyên dùng **ElevenLabs** chọn giọng *Adam* hoặc *Rachel* tiếng Việt, hoặc **CapCut AI Voice** giọng *Thanh Niên Tự Tin*):

```text
Xin chào Ban Giám Khảo UniHack 2026. Đây là MindSpark — Nền tảng Proof of Cognitive Effort trên Avalanche, khắc phục tình trạng xao nhãng smartphone và gian lận trong học tập bằng sự kết hợp giữa Edge-AI và Blockchain.

Đầu tiên, người học kết nối ví MetaMask trên mạng Avalanche Fuji Testnet và chọn chủ đề học tập. Để tạo động lực kỷ luật, học viên đặt cọc 0.01 AVAX vào Smart Contract StudyStakeVault. Giao dịch được xác nhận sau 1 giây.

Phiên học bắt đầu. 100% hình ảnh camera được xử lý bảo mật trên RAM bằng MediaPipe WASM, không gửi video lên máy chủ. Khi người học cúi viết bài hoặc đọc sách, AI nhận diện tư thế nỗ lực sâu và duy trì chỉ số Focus Index 98% đến 100%. Đặc biệt, hệ thống phân biệt được tư thế hai tay ôm đầu suy nghĩ để không bắt nhầm, tôn trọng nhịp tư duy tự nhiên.

Khi người học cầm điện thoại thật lên trước mặt, mô hình ObjectDetector lập tức bật cảnh báo đỏ và tự động tạm dừng đồng hồ sau 5 giây. Nếu người học rời khỏi khung hình quá thời gian cho phép, hệ thống cũng tự động kích hoạt chế độ vắng mặt để đảm bảo tính công bằng.

Hết giờ học, người học hoàn thành bài thẩm định nhận thức qua 2 lựa chọn: Thuyết trình Feynman 30 giây hoặc Làm Quiz 5 câu. Với Feynman 30 giây, mô hình Whisper bóc băng giọng nói, hiển thị bản transcript minh bạch trước khi gửi AI chấm điểm hiểu bài. Hoặc sinh viên có thể làm Quiz AI 5 câu bám sát tài liệu tải lên. Trả lời đúng từ 3 trên 5 câu để nhận chữ ký mật mã Oracle.

Oracle Server cấp chữ ký số EIP-191 hợp lệ trên Avalanche Fuji, chứng minh nỗ lực nhận thức thực sự đã hoàn thành. Học viên bấm Rút cọc: Hợp đồng StudyStakeVault hoàn trả 100% tiền cọc 0.01 AVAX kèm tiền thưởng từ Quỹ phạt Penalty Pool. Đồng thời, thẻ sinh viên Soulbound StudyBadgeSBT tự động được nâng cấp miễn phí gas, thay đổi giao diện SVG động ngay trên chuỗi.

Tiếp theo, tại Tab Skill Tree, học viên có thể theo dõi tiến trình 5 cấp bậc học giả và đổi các phần quà giá trị tại Reward Marketplace. Tại Tab Sổ tay Flashcard, các thẻ ghi nhớ vừa học được tự động lưu lại. Học viên có thể hỏi đáp chuyên sâu với AI Socratic Copilot. Mỗi câu hỏi kích hoạt cơ chế vi thanh toán 0.005 AVAX chuẩn HTTP 402, cho phép dòng tiền học bổng vi mô chảy tức thì trên Avalanche.

MindSpark — Biến từng phút nỗ lực học tập thành giá trị xác thực trên Blockchain Avalanche. Cảm ơn Ban Giám Khảo!
```

---

## 🛠️ PHẦN 3: QUY TRÌNH 3 BƯỚC ĐỂ XUẤT VIDEO HOÀN CHỈNH (10 - 15 PHÚT)

### Bước 1: Quay màn hình thao tác theo kịch bản (2 - 3 phút)
1. Khởi động 3 terminal (`contracts`, `ai-service`, `frontend`) và mở `http://localhost:3000`.
2. Nhấn tổ hợp phím **`Win + Alt + R`** (công cụ quay màn hình có sẵn trên Windows) hoặc bật **OBS Studio**.
3. Thao tác chậm rãi, rõ ràng theo đúng 5 phân cảnh:
   * **Cảnh 1 (0:00 - 0:30):** Kết nối ví MetaMask ➔ Nhập chủ đề ➔ Bấm "Đặt nhanh 1 phút" ➔ Bấm "Start Stake 0.01 AVAX" ➔ Duyệt MetaMask.
   * **Cảnh 2 (0:30 - 1:15):** Ngồi viết bài (Tag hiện `Writing Pose`) ➔ Đưa tay lên đầu suy nghĩ ➔ Cầm điện thoại lên cho hiện cảnh báo đỏ ➔ Đứng dậy rời ghế 2 giây.
   * **Cảnh 3 (1:15 - 1:50):** Bấm "Xong sớm" ➔ Bấm "Thuyết trình Feynman 30s" nói vài câu (hoặc chọn Làm Quiz 5 câu) ➔ Nhận chữ ký Oracle.
   * **Cảnh 4 (1:50 - 2:20):** Bấm nút "Rút 0.01 AVAX Cọc" ➔ Duyệt ví thành công ➔ Nhận thưởng.
   * **Cảnh 5 (2:20 - 2:45):** Bấm chuyển sang Tab `Skill Tree & x402` ➔ Lướt qua Marketplace ➔ Chuyển sang Tab `Sổ tay Flashcard`.
4. Nhấn lại **`Win + Alt + R`** để dừng quay. File video sẽ lưu tại thư mục: `Videos\Captures`.

---

### Bước 2: Tạo giọng đọc AI & Tự động ghép trong CapCut (Miễn phí)
1. Tải và mở phần mềm **CapCut** (hoặc dùng CapCut Web tại [capcut.com](https://www.capcut.com)).
2. Kéo thả video vừa quay ở Bước 1 vào dòng thời gian (Timeline).
3. **Cách tạo giọng đọc AI:**
   * Bấm vào mục **Text (Văn bản)** ➔ Chọn **Add text (Thêm chữ)** ➔ Dán toàn bộ đoạn văn bản ở **PHẦN 2** vào.
   * Bấm nút **Text to Speech (Chuyển văn bản thành giọng nói)** ở cột bên phải.
   * Chọn giọng đọc tiếng Việt: ví dụ giọng **Thanh Niên Tự Tin** hoặc **Cô Gái Nhẹ Nhàng** ➔ Bấm **Generate (Tạo)**.
   * CapCut sẽ tự sinh ra file giọng đọc AI trong veo và đặt ngay ngắn bên dưới video!
4. **Cách tạo phụ đề Vietsub động (Auto-Captions):**
   * Bấm vào tab **Captions (Phụ đề)** trên thanh công cụ.
   * Bấm **Auto captions (Phụ đề tự động)** ➔ Chọn ngôn ngữ **Vietnamese** ➔ Bấm **Generate**.
   * Chỉ sau 10 giây, toàn bộ Vietsub sẽ hiện lên màn hình. Bạn chọn một mẫu chữ nổi bật (chữ trắng viền đen hoặc chữ vàng công nghệ).

---

### Bước 3: Xuất video thành phẩm (Export)
* Bấm nút **Export (Xuất file)** ở góc trên bên phải CapCut.
* Chọn độ phân giải: **1080p (Full HD)**, tốc độ khung hình: **30fps hoặc 60fps**.
* Đặt tên file: **`MindSpark_Demo_Pitch_UniHack2026.mp4`**.
* File video xuất ra sẽ có đầy đủ:
  - Hình ảnh thao tác mượt mà Full HD.
  - Giọng thuyết minh AI chuẩn studio không một hạt tạp âm.
  - Phụ đề Vietsub chạy động theo từng từ cực kỳ chuyên nghiệp!
