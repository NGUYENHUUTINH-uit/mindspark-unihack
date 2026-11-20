# 📘 Hướng Dẫn Cài Đặt, Chạy Thử & Kịch Bản Demo MindSpark (Dành Cho Thành Viên Nhóm)

Tài liệu này giúp mọi thành viên trong đội dựng lại đầy đủ 3 tầng hệ thống (**Web3 Gateway :4020** — **AI Service :8000** — **Frontend :3000**), kiểm thử trước giờ G và trình bày **kịch bản Demo chuẩn 3 phút (tối đa 3:00)** mượt mà trước Ban Giám Khảo **UniHack 2026**.

---

## 📌 Bước 0: Chuẩn Bị Môi Trường & Ví Web3 Trên Trình Duyệt

### 1. Công cụ cần cài sẵn
* **Node.js**: phiên bản `v20+` (`node -v`)
* **Python**: phiên bản `3.11+` (`python --version`)
* **Git** và trình duyệt **Chrome / Brave / Edge** có **Webcam + Micro** hoạt động tốt.

### 2. Cài Extension Ví MetaMask hoặc Core Wallet (Rất quan trọng — Tránh cài nhầm!)
* Trang Web3 (`http://localhost:3000`) chỉ kết nối được thông qua **Extension ví gắn trên thanh công cụ Chrome/Edge**, **KHÔNG** kết nối được nếu chỉ mở tab website `https://core.app`.
* Link cài chính thức từ Chrome Web Store:
  * **MetaMask (Khuyên dùng):** [Cài MetaMask Extension](https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn)
  * **Hoặc Avalanche Core Extension:** [Cài Core Crypto Wallet Extension](https://chromewebstore.google.com/detail/core-crypto-wallet-nft-e/agoakfejjabomempkjlepdfladaackdn)
* ⚠️ **Lưu ý tránh xung đột ví:** Không cài đồng thời các ví khác hệ EVM (ví dụ *Pontem Wallet* của Aptos) trên cùng profile trình duyệt để tránh ví đó chiếm quyền `window.ethereum` gây lỗi `The requested method and/or account has not been authorized`.

### 3. Thêm mạng Avalanche Fuji & Nhận AVAX Testnet miễn phí
1. Bấm kết nối ví trên trang web ➔ nếu hiện nút cam **"⚠️ Chuyển sang Avalanche Fuji"**, bấm vào để ví tự thêm mạng **Avalanche Fuji Testnet (Chain ID `43113`)**.
2. Copy địa chỉ ví `0x...` trong MetaMask.
3. Nhận AVAX Fuji miễn phí tại **[faucet.avax.network](https://faucet.avax.network/)** (hoặc Avalanche Console Testnet Faucet) — tối thiểu nên có từ **`0.05 AVAX`** để thoải mái test nhiều phiên cọc (`0.01 AVAX/phiên`) và hỏi AI Copilot (`0.005 AVAX/lượt`).

---

## 🛠️ Bước 1: Tải Mã Nguồn & Cài Thư Viện 3 Tầng

Mở PowerShell (hoặc Terminal) và chạy lần lượt:

```powershell
# 1. Di chuyển vào thư mục dự án và đảm bảo đúng nhánh
cd d:\HCMUS_N3\UniHack\mindspark-unihack
git checkout feature/submission-hardening
git pull origin feature/submission-hardening

# 2. Cài đặt Smart Contracts & API Gateway (Node)
cd d:\HCMUS_N3\UniHack\mindspark-unihack\contracts
npm install --force

# 3. Cài đặt AI Service (Python venv)
cd d:\HCMUS_N3\UniHack\mindspark-unihack\ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 4. Cài đặt Frontend Next.js
cd d:\HCMUS_N3\UniHack\mindspark-unihack\frontend
npm install
```

*(Ghi chú macOS/Linux: thay `.\.venv\Scripts\python.exe` bằng `./.venv/bin/python` ở các lệnh Python bên dưới).*

---

## 🔐 Bước 2: Cấu Hình 3 File Biến Môi Trường (`.env`)

Copy từ các file `.env.example` có sẵn trong repo. **TUYỆT ĐỐI không `git add` hay đẩy file `.env` thật lên GitHub!**

### 1. `contracts/.env` (copy từ `contracts/.env.example`)
```env
# Khóa bí mật của ví Oracle đã cấu hình trên Fuji Vault:
# Đặt đúng Private Key của ví đã deploy / làm oracleSigner cho bộ contract hiện tại
ORACLE_PRIVATE_KEY=0x<PRIVATE_KEY_CUA_VI_ORACLE>
FUJI_PRIVATE_KEY=0x<PRIVATE_KEY_CUA_VI_ORACLE>
SNOWTRACE_API_KEY=<OPTIONAL_SNOWTRACE_KEY>
# Đặt true chỉ khi cần nút Demo Fast-Track dự phòng lúc AI Service tắt
ENABLE_DEMO_ATTEST=false
```
> **Quan trọng:** Nếu thiếu `contracts/.env`, API Gateway sẽ dùng ví test mặc định của Hardhat (`0xf39Fd6...`), dẫn đến khi bấm Rút cọc on-chain hợp đồng `StudyStakeVault` sẽ báo lỗi **`Invalid Oracle signature`**!

#### 🔑 Cách lấy Private Key từ ví MetaMask (Chỉ dùng cho ví Testnet)
Nếu bạn dùng ví MetaMask mới tạo trên **Avalanche Fuji Testnet** để làm Oracle / Deploy:
1. Mở tiện ích **MetaMask** ở góc trên bên phải Chrome.
2. Bấm vào dòng tên tài khoản **`Account 1 ▾`** ở phía trên cùng bên trái của MetaMask.
3. Bấm vào biểu tượng **3 chấm dọc `⋮`** ngay bên cạnh `Account 1`.
4. Chọn **`Chi tiết tài khoản` (`Account details`)**.
5. Bấm **`Hiển thị khóa riêng tư` (`Show private key`)** ➔ Nhập mật khẩu đăng nhập MetaMask ➔ **Nhấn giữ** nút xác nhận vài giây.
6. Bấm **Copy** chuỗi 64 ký tự hex (nếu chưa có `0x` ở đầu thì thêm `0x` phía trước) rồi dán vào cả 2 dòng `ORACLE_PRIVATE_KEY=` và `FUJI_PRIVATE_KEY=` trong `contracts/.env`.

> ⚠️ **Cảnh báo an toàn:** Tuyệt đối **KHÔNG** dùng ví đang chứa tiền thật (Mainnet), và tuyệt đối **KHÔNG** commit `contracts/.env` hay gửi Private Key lên GitHub/nhóm chat công khai.

#### 🤝 Hướng dẫn chia sẻ bản Deploy cho thành viên khác test
Sau khi người triển khai đã deploy bộ contract mới lên Fuji và push địa chỉ mới trong `contracts/deployed-addresses.json` + `frontend/.env.example` lên Git, các thành viên khác có **2 cách** để test trên máy của mình:
* **Cách A — Test chung bộ Contract của nhóm (Khuyên dùng):**
  1. Chạy `git pull` để nhận đúng địa chỉ 3 contract mới nhất.
  2. Xin **Private Key của ví Oracle testnet** từ người deploy qua tin nhắn riêng (tuyệt đối không đẩy lên Git) để dán vào `contracts/.env` trên máy mình (để API Gateway ký giấy rút cọc khớp với Vault).
  3. Khi mở `http://localhost:3000` để trải nghiệm, thành viên vẫn có thể kết nối bằng **chính ví MetaMask cá nhân của mình** (miễn có AVAX Fuji Faucet) để Stake `0.01 AVAX`, Claim hoàn cọc và Mint SBT bình thường!


### 2. `ai-service/.env` (copy từ `ai-service/.env.example`)
```env
GROQ_API_KEY=gsk_...          # Lấy miễn phí tại https://console.groq.com
GEMINI_API_KEY=AIza...        # Lấy miễn phí tại https://aistudio.google.com
STT_MODEL=whisper-large-v3-turbo
LLM_MODEL=gemini-3.5-flash-lite
ORACLE_SERVICE_URL=http://localhost:4020
ORACLE_API_KEY=mindspark-internal-secret-2026
ORACLE_MOCK=false
CORS_ORIGINS=http://localhost:3000
```

### 3. `frontend/.env.local` (copy từ `frontend/.env.example`)
```env
NEXT_PUBLIC_VAULT_ADDRESS=0xB4B96B56E7b86ed7484Fe26919c509E14E6fb111
NEXT_PUBLIC_SBT_ADDRESS=0x9D3756BeE86E9FF34773B4D3f9E323FfdD8F3afA
NEXT_PUBLIC_X402_ADDRESS=0x25e95555fed513Cb0d5a4Cb9FA0e2A698F5ED9eE
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:4020
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

---

## 🚀 Bước 3: Khởi Chạy 3 Terminal & Kiểm Tra Trước Giờ G (Pre-Flight Checklist)

Mở **3 cửa sổ PowerShell riêng biệt**:

```powershell
# Terminal 1 — Web3 Gateway & Oracle Signer (Cổng 4020)
cd d:\HCMUS_N3\UniHack\mindspark-unihack\contracts
node services/apiGateway.js

# Terminal 2 — AI Service FastAPI (Cổng 8000)
cd d:\HCMUS_N3\UniHack\mindspark-unihack\ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend Studio Next.js (Cổng 3000)
cd d:\HCMUS_N3\UniHack\mindspark-unihack\frontend
npm run dev
```

### ✅ Checklist kiểm tra 30 giây trước khi thuyết trình
Chạy lệnh kiểm tra nhanh trong 1 Terminal khác:
```powershell
Invoke-RestMethod http://localhost:4020/health | Select-Object status, oracleAddress, onChainOracleAddress, oracleKeyMatchesChain
Invoke-RestMethod http://localhost:8000/health
```
Đảm bảo đủ **5 tiêu chí xanh** trước khi gọi Ban Giám Khảo:
1. Terminal 1 (`:4020`) in dòng **`✅ Oracle key khớp on-chain oracleSigner (0xA206...)`** và `/health` trả `oracleKeyMatchesChain: True`.
2. `http://localhost:8000/health` trả `status: "healthy"`.
3. Mở `http://localhost:3000` trên Chrome: đã kết nối ví **MetaMask/Core**, đúng mạng **Avalanche Fuji**, số dư ≥ **`0.05 AVAX`**.
4. Nếu ví đang bị kẹt 1 phiên stake cũ trên Fuji, kiểm tra banner xanh **"⚡ Phiên cọc 0.01 AVAX của bạn đang được bảo vệ trên Fuji!"** (hoặc rút cọc trước để quay demo mới từ đầu cho đẹp).
5. Cấp quyền **Camera** và **Micro** cho `http://localhost:3000` trước khi bấm quay.

*(Để chạy lại toàn bộ 84 test tự động trước khi nộp bài: chạy `npx hardhat test` trong `contracts/` [31/31 passing], `.\.venv\Scripts\python.exe -m pytest -v` trong `ai-service/` [53/53 passed], và `npm run build` trong `frontend/` [exit code 0]).*

---

## 🎬 Bước 4: Kịch Bản Demo Video & Thuyết Trình Chuẩn ≤ 3 Phút (Mục tiêu 2:55)

> 💡 **Mẹo quay video dưới 3 phút thật mượt:** Mọi khung hình cắt bớt thời gian chờ xác nhận giao dịch MetaMask (~2–3 giây/tx) để giữ nhịp nhanh, gọn, tổng độ dài chuẩn **2 phút 55 giây**.

### **0:00 – 0:35 (35s) | 1. Login (Kết nối ví) → Thiết lập & Đặt Cọc (`Stake 0.01 AVAX`)**
* **Thao tác trên màn hình:**
  1. Mở `http://localhost:3000`, chỉ góc trên bên phải cho thấy ví **MetaMask** đã kết nối mạng **Avalanche Fuji Testnet** và có sẵn AVAX.
  2. Nhập nhanh chủ đề học vào ô lớn (ví dụ: *Cây nhị phân tìm kiếm* hoặc để trống nếu muốn lát demo tải tệp ở Quiz).
  3. Bấm **"Đặt nhanh 1 phút (Demo)"** ở góc dưới thẻ Pomodoro.
  4. Bấm **"Start (Stake 0.01 AVAX)"** ➔ Bấm **Confirm** trên MetaMask ➔ Hệ thống tự mở **Phòng học Studio Camera** ngay sau khi cọc thành công on-chain.
* **Lời thoại gợi ý:**
  > *"MindSpark chống xao nhãng và gian lận Study-to-Earn trên Avalanche. Trước khi vào bàn, người học kết nối ví MetaMask trên Avalanche Fuji, chọn chủ đề và đặt cọc cam kết `0.01 AVAX` vào Smart Contract `StudyStakeVault`."*

---

### **0:35 – 1:20 (45s) | 2. Học Thật & Demo Camera Edge-AI (3 Tình Huống Thật)**
* **Thao tác trên màn hình:**
  1. Đợi 1–2 giây thấy góc trên trái video hiện **`MediaPipe WASM • Phone & Person AI`** cùng nhãn **`Zero-Video-Upload`**, `Blink`, `Liveness` (có thể bấm **Phóng to** nhanh rồi **Thu nhỏ**).
  2. **Học thật + Chống báo nhầm:** Ngồi viết/đọc bài (`Writing Pose`) ➔ **đưa 2 tay lên ôm đầu suy nghĩ** ➔ chỉ vào nhãn xanh da trời **`🧠 Tư thế suy nghĩ / Nghỉ ngơi`** (chứng minh không bắt nhầm).
  3. **Bắt cầm điện thoại thật:** Cầm chiếc **điện thoại thật** lên trước camera ~1–2 giây ➔ HUD bật cảnh báo đỏ **`📱 Phát hiện điện thoại`**, đếm đủ **5 giây** sẽ tự động tạm dừng đồng hồ Pomodoro (`⏸️ Tạm dừng AI`) + phát chuông ➔ cất điện thoại xuống để đồng hồ chạy lại.
  4. **Bắt rời khung hình:** Đứng dậy bước ra ngoài khung hình ~2 giây ➔ HUD bật cảnh báo **`⚠️ Vắng mặt / Rời khung hình`**, đếm 5 giây sẽ tự tạm dừng đồng hồ ➔ ngồi lại vào ghế.
* **Lời thoại gợi ý:**
  > *"100% khung hình camera được xử lý trên RAM trình duyệt, không gửi video lên server. AI vừa hiểu tư thế suy nghĩ hai tay trên đầu không phạt nhầm, vừa chạy ObjectDetector nhận diện điện thoại thật hoặc phát hiện người rời ghế để tự động tạm dừng đồng hồ."*

---

### **1:20 – 1:55 (35s) | 3. Hoàn Thành Phiên → Đánh Giá Chủ Động (Feynman 30s / Quiz)**
* **Thao tác trên màn hình:**
  1. Bấm **"Hoàn thành phiên học → Chọn bài kiểm tra"** (hoặc để timer 1 phút tự kết thúc).
  2. Lướt nhanh 3 lựa chọn trên thẻ: **Thuyết trình Feynman 30s**, **Làm Quiz 5 câu**, và nút **Nghỉ giải lao** (giải thích 1 câu: giải lao giúp tắt camera AI tạm thời mà không mất cọc).
  3. Chọn **1 luồng nhanh nhất khi quay** (khuyên dùng cho video ≤ 3 phút):
     * **Luồng A (Feynman 2 bước):** Bấm **Thuyết trình Feynman 30s** ➔ nói 1–2 câu rõ ràng dài ≥ 15 từ trong ~8 giây ➔ bấm **Dừng & Xem bản chép AI** ➔ cho thấy khung `<audio>` nghe lại & văn bản Groq Whisper chuẩn xác ➔ bấm **Gửi AI chấm điểm & Cấp Proof**.
     * **Hoặc Luồng B (Quiz Mode B Upload tài liệu):** Bấm **Làm Quiz trắc nghiệm 5 câu** ➔ tải file `.txt` / `.docx` / `.pdf` (hoặc dùng chủ đề đã nhập) ➔ chọn đúng ≥ 3/5 câu ➔ bấm **Nộp bài & Nhận Proof**.
* **Lời thoại gợi ý:**
  > *"Kết thúc giờ học, người học chứng minh mình đã hiểu bài thật bằng cách thuyết trình Feynman 30 giây (có màn hình kiểm tra transcript chống mic ù/ảo giác) hoặc làm Quiz AI 5 câu bám sát tài liệu tải lên để nhận chữ ký Oracle EIP-191."*

---

### **1:55 – 2:30 (35s) | 4. Hoàn Cọc + Nhận Thưởng On-Chain + SBT Gasless**
* **Thao tác trên màn hình:**
  1. Trên `ResultModal` 2 cột, chỉ nhanh **3 luồng phần thưởng**: Hoàn **`0.0100 AVAX`** cọc + Bonus Penalty Pool, Học bổng **x402** theo phút, và **`+EXP`** tích lũy nâng cấp thẻ SBT (mở khóa quà ở Reward Marketplace).
  2. Bấm **"Rút 0.01 AVAX Cọc + Nhận Thưởng & Nâng Cấp SBT"** ➔ **Confirm** trên MetaMask.
  3. Đợi pháo hoa chúc mừng ➔ chỉ dòng **StudyBadgeSBT tự động nâng cấp miễn phí gas** & nút nhận thêm **`+0.0030 AVAX` Học bổng x402** (hoặc bấm mở nhanh **Snowtrace** 3 giây rồi đóng modal).
* **Lời thoại gợi ý:**
  > *"Với chữ ký EIP-191 từ Oracle, học viên rút trọn vẹn `0.01 AVAX` tiền cọc kèm bonus từ quỹ phạt, đồng thời hệ thống tự động mint và nâng cấp thẻ Soulbound Scholar Badge không tốn gas và mở khóa dòng tiền học bổng x402."*

---

### **2:30 – 2:55 (25s) | 5. Các Tab Ở Dưới (`Skill Tree & x402` & `Sổ tay Flashcard`) + Kết Thúc**
* **Thao tác trên màn hình:**
  1. Bấm chuyển sang tab **`Skill Tree & x402`** ở thanh điều hướng phía dưới ➔ kéo lướt qua **thẻ SBT SVG động on-chain** (Lv.1 → Lv.5), quỹ tài trợ Bounty Pool và khu **Reward Marketplace** nơi điểm EXP / cấp SBT dùng để đổi voucher & học bổng.
  2. Bấm chuyển sang tab **`Sổ tay Flashcard`** ➔ bấm lật 1 thẻ Flashcard 3D vừa tự động sinh sau phiên học ➔ chỉ vào hộp **AI Socratic Copilot (`0.005 AVAX/câu`)** minh họa thanh toán vi mô chuẩn **HTTP 402** trực tiếp trên Avalanche Fuji.
* **Lời thoại kết (5s):**
  > *"MindSpark biến từng phút tập trung thành bằng chứng tri thức xác thực được trên Avalanche — kết nối kỷ luật cá nhân với kinh tế học tập x402. Cảm ơn Ban Giám Khảo!"*

---

### 💬 Bộ Q&A Dự Phòng Khi Giám Khảo Hỏi Thêm (Ngoài 3 phút video)
* **Q1: Video webcam sinh viên có gửi lên server AI không?**  
  *A:* Tuyệt đối không. Toàn bộ MediaPipe WASM (`PoseLandmarker` + `FaceLandmarker` + `ObjectDetector`) và Edge Canvas chạy trên RAM trình duyệt (`Zero-Video-Upload`). Audio Feynman cũng chỉ xử lý tạm trên RAM backend và tự hủy ngay sau khi transcribe.
* **Q2: Làm sao chống gian lận nói nhảm, dùng ảnh tĩnh hoặc sửa điểm Frontend?**  
  *A:* Có 4 lớp chốt chặn: (1) Đếm blink/motion trên camera chống ảnh in; (2) Bộ lọc Whisper + LLM kiểm tra `>= 15 từ` và không lạc đề (`is_gibberish`); (3) Quiz giữ đáp án bí mật ở server & chỉ dùng 1 lần; (4) Vault chỉ nhả tiền khi chữ ký EIP-191 của Oracle khớp `msg.sender`, `nonce`, `chainId` và `address(vault)`.
* **Q3: Điểm `+EXP` và `StudyBadgeSBT` dùng để làm gì?**  
  *A:* Điểm EXP phản ánh tiến độ cộng dồn số phút học thực tế vào NFT Soulbound `StudyBadgeSBT` (Level 1 → 5: mốc 0 / 300 / 900 / 1800 / 3000 phút), giúp thăng hạng huy hiệu không thể chuyển nhượng on-chain và mở khóa các phần quà thực tế tại **Reward Marketplace** (voucher khóa học Avalanche Builders, gói lượt hỏi AI Copilot, học bổng Cloud Credits \$50).
* **Q4: Tại sao dùng chuẩn x402 trên Avalanche Fuji?**  
  *A:* Finality dưới 1 giây của Avalanche C-Chain giúp trải nghiệm **HTTP 402 Pay-per-Query (`0.005 AVAX`)** và stream học bổng vi mô theo phút (`0.0001 AVAX/min`) diễn ra gần như tức thì, phí gas không đáng kể.

---

## 🔧 Bước 5: Cẩm Nang Xử Lý Sự Cố Nhanh Khi Demo

| Lỗi / Tình huống gặp phải | Nguyên nhân | Cách xử lý ngay trong 15 giây |
|---|---|---|
| **Cảnh báo lệch ví Oracle / `Invalid Oracle signature`** | Chưa tạo `contracts/.env` hoặc key không khớp ví Oracle đã deploy (`0xA206...`) | Điền đúng `ORACLE_PRIVATE_KEY` vào `contracts/.env` rồi khởi động lại Terminal 1 (`node services/apiGateway.js`). |
| **`nonce too low: next nonce 2, tx nonce 1`** | Cache thứ tự giao dịch trên MetaMask chậm hơn 1 block so với Fuji | Mở MetaMask ➔ **Settings ➔ Advanced ➔ Clear activity tab data**, rồi bấm Claim lại (Frontend cũng tự lấy `pending nonce`). |
| **`The requested method and/or account has not been authorized`** | Xung đột ví khác (vd Pontem) hoặc site chưa kết nối lại | Gỡ extension ví không phải EVM, bấm ngắt kết nối `localhost:3000` trong MetaMask rồi **F5** kết nối lại. |
| **Web báo không tìm thấy ví dù đã mở `core.app`** | Đang mở Dashboard web của Core thay vì cài Extension trình duyệt | Cài extension **MetaMask** hoặc **Core Crypto Wallet** trên Chrome Web Store rồi **F5** lại trang. |
| **Ghi âm Feynman ra rỗng / báo mic nhỏ** | Micro máy tính để nhỏ, chưa cấp quyền, hoặc nói lúc im lặng nên bộ lọc xóa ảo giác | Kiểm tra quyền Mic trên biểu tượng ổ khóa thanh URL; nghe lại `<audio>` ngay ở Bước 2, gõ bổ sung tóm tắt hoặc bấm **Chuyển sang Quiz 5 câu**. |
| **Sinh Quiz chậm / lỗi AI** | Model LLM chính bị giới hạn tần suất (429) | Hệ thống tự fallback sang `gemini-3.5-flash-lite` và Groq JSON trong ~2–4s; nếu mất mạng hoàn toàn sẽ bật Quiz Offline (chỉ lưu ý bản Offline chưa có chữ ký Oracle trừ khi bật `ENABLE_DEMO_ATTEST=true`). |
| **Lỡ đóng tab / F5 sau khi đã cọc `0.01 AVAX`** | Phiên stake đang nằm on-chain ở hợp đồng `StudyStakeVault` | Mở lại `http://localhost:3000`, kết nối lại ví ➔ bấm **`▶ Tiếp tục phiên học`** hoặc **`🔓 Kết thúc & Rút cọc ngay`** trên banner xanh. |
