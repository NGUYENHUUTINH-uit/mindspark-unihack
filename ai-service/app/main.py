"""
main.py — Entry point của FastAPI app.
Khởi tạo app, đăng ký CORS middleware, mount routers, định nghĩa /health.
"""
import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import feynman, quiz
from app.schemas import HealthResponse

# ---------------------------------------------------------------------------
# Logging: chỉ log level INFO trở lên, không để lộ stack trace ra response
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("mindspark.main")

# ---------------------------------------------------------------------------
# Khởi tạo FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MindSpark AI Service",
    description="Feynman Voice Reflection & Quiz API — UniHack 2026",
    version="1.0.0",
    # Ẩn docs trong production nếu cần; để mở cho hackathon
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS — đọc danh sách origin từ settings
# ---------------------------------------------------------------------------
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Middleware log thời gian xử lý từng request
# ---------------------------------------------------------------------------
@app.middleware("http")
async def _log_request_time(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s → %d (%.0f ms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Global exception handler — không để lộ stack trace
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi nội bộ máy chủ. Vui lòng thử lại sau."},
    )


# ---------------------------------------------------------------------------
# Mount routers
# ---------------------------------------------------------------------------
app.include_router(feynman.router, prefix="/api/feynman", tags=["Feynman Voice"])
app.include_router(quiz.router,    prefix="/api/quiz",    tags=["Quiz"])


# ---------------------------------------------------------------------------
# Health check — không cần auth
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Kiểm tra service còn sống.
    Frontend/CI có thể poll endpoint này trước khi gửi request thật.
    """
    return HealthResponse(
        status="healthy",
        service="MindSpark AI Service",
        version="1.0.0",
    )

