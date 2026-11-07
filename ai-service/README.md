# MindSpark AI Service

**FastAPI backend** cho Module 2: Feynman Voice Reflection & Quiz  
Dự án MindSpark — UniHack 2026 (Avalanche Fuji)

---

## Cấu trúc thư mục

```
ai-service/
├── app/
│   ├── main.py          # FastAPI app, CORS, middleware
│   ├── config.py        # Pydantic-settings, đọc .env
│   ├── schemas.py       # Tất cả Pydantic v2 request/response models
│   ├── routers/
│   │   ├── feynman.py   # POST /api/feynman/evaluate
│   │   └── quiz.py      # POST /api/quiz/generate, /api/quiz/submit
│   └── services/
│       ├── stt.py           # Groq Whisper → transcript
│       ├── llm.py           # Gemini → chấm điểm, sinh quiz
│       ├── quiz.py          # Logic chấm quiz & flashcard (thuần Python)
│       ├── session_store.py # In-memory store (quiz + proof tracking)
│       └── oracle_client.py # Gọi Oracle service để lấy chữ ký EIP-191
├── tests/
├── samples/             # Đặt file audio mẫu để test thủ công
├── requirements.txt
├── .env.example         # Template — KHÔNG commit .env thật
└── README.md
```

---

## Cài đặt & Chạy (Windows PowerShell)

```powershell
# 1. Di chuyển vào thư mục ai-service
cd d:\HCMUS_N3\UniHack\mindspark-unihack\ai-service

# 2. Tạo virtual environment
py -m venv .venv

# 3. Kích hoạt venv
.\.venv\Scripts\Activate.ps1

# 4. Cài dependencies
pip install -r requirements.txt

# 5. Tạo file .env từ template rồi điền key thật
copy .env.example .env
# Mở .env bằng editor và điền GROQ_API_KEY, GEMINI_API_KEY, ...

# 6. Chạy server (từ thư mục ai-service/)
uvicorn app.main:app --reload --port 8000
```

Server sẽ chạy tại: http://localhost:8000  
Swagger UI: http://localhost:8000/docs

---

## Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| `GET`  | `/health` | Kiểm tra service còn sống |
| `POST` | `/api/feynman/evaluate` | Chế độ A: nộp audio, chấm Feynman |
| `POST` | `/api/quiz/generate` | Chế độ B: sinh câu hỏi quiz |
| `POST` | `/api/quiz/submit` | Chế độ B: nộp bài, lấy proof |

---

## Biến môi trường (`.env`)

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `GROQ_API_KEY` | ✅ | API key Groq (Whisper STT) |
| `GEMINI_API_KEY` | ✅ | API key Google Gemini |
| `STT_MODEL` | | Mặc định: `whisper-large-v3-turbo` |
| `LLM_MODEL` | | Mặc định: `gemini-2.0-flash-lite` |
| `ORACLE_SERVICE_URL` | | URL oracle service, mặc định `http://localhost:4020` |
| `ORACLE_API_KEY` | | Secret header `x-oracle-auth` cho oracle |
| `ORACLE_MOCK` | | `true` → dùng proof giả khi dev (mặc định `false`) |
| `CORS_ORIGINS` | | Danh sách origin, cách nhau bởi dấu phẩy |

---

## Dev mode (không cần oracle thật)

Trong `.env`, đặt:
```
ORACLE_MOCK=true
```
Khi đó, nếu sinh viên đạt điểm chuẩn, service sẽ trả proof giả có `mock: true` thay vì gọi oracle thật.

---

## Chạy tests

```powershell
cd d:\HCMUS_N3\UniHack\mindspark-unihack\ai-service
.\.venv\Scripts\Activate.ps1
pytest tests/ -v
```

---

## Lưu ý quan trọng

> ⚠️ **Session store in-memory**: Dữ liệu quiz và proof tracking **sẽ mất khi restart server**.  
> Cho hackathon là đủ dùng. Nếu cần persistence, thay bằng Redis hoặc SQLite.

> ⚠️ **Audio chỉ xử lý trong RAM**: File audio không bao giờ được ghi ra đĩa.

> ⚠️ **Mỗi session_id chỉ được cấp 1 proof**: Dù chọn chế độ A hay B.  
> Gửi lại cùng `session_id` đã có proof sẽ nhận HTTP 409.

---

## Quy đổi điểm LLM → Oracle

Oracle yêu cầu `feynmanScore` trong khoảng **[50, 100]**.  
LLM chấm thang **1–10**.  
Công thức quy đổi: `feynmanScore = max(50, min(100, round(50 + score × 5)))`

Ví dụ: score = 7 → feynmanScore = 85

---

## Thêm pytest vào CI (gợi ý)

Thêm job sau vào `.github/workflows/ci.yml` (chưa sửa file thật):

```yaml
  test-ai-service:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ai-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run pytest
        env:
          GROQ_API_KEY: dummy_for_test
          GEMINI_API_KEY: dummy_for_test
          ORACLE_MOCK: "true"
        run: pytest tests/ -v
```

