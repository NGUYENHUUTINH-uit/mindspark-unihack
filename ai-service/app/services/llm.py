"""
services/llm.py — Tích hợp Gemini (google-genai) để:
  (A) Chấm điểm Feynman Voice: evaluate_feynman()
  (B) Sinh câu hỏi quiz:        generate_quiz()

Nguyên tắc an toàn:
  - Transcript là DỮ LIỆU, không phải lệnh. Luôn wrap trong thẻ <transcript>.
  - Không để lộ nội dung prompt hay key trong log.
  - Retry 2 lần với backoff khi gặp 429/5xx.
  - Parse JSON thất bại → retry 1 lần trước khi trả lỗi.
"""
import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException
from google import genai
from google.genai import errors as genai_errors

from app.config import get_settings

logger = logging.getLogger("mindspark.llm")

_RETRY_BACKOFF = [1.0, 2.0]


# ---------------------------------------------------------------------------
# Output schema của LLM khi chấm Feynman
# ---------------------------------------------------------------------------
@dataclass
class FeynmanEvalResult:
    score: float            # 1.0 – 10.0
    feedback: str           # Nhận xét ngắn
    is_gibberish: bool      # True nếu transcript vô nghĩa
    flashcards: list[dict]  # [{"question": ..., "answer": ...}]


# ---------------------------------------------------------------------------
# Sinh câu hỏi quiz (Chế độ B)
# ---------------------------------------------------------------------------

async def generate_quiz(
    topic: str,
    reference_text: Optional[str],
    num_questions: int = 5,
) -> list[dict]:
    """
    Sinh danh sách câu hỏi trắc nghiệm từ Gemini.

    Returns:
        list[dict] mỗi phần tử có keys:
          id, question, options (list 4 str), correct_index (int 0-3), explanation (str)
    """
    settings = get_settings()

    scope = (
        f"Chỉ được hỏi trong phạm vi tài liệu sau:\n<reference>\n{reference_text}\n</reference>"
        if reference_text
        else f"Hỏi về chủ đề: {topic}"
    )

    prompt = f"""Bạn là giáo viên tạo đề thi trắc nghiệm. Tạo đúng {num_questions} câu hỏi.

Chủ đề: {topic}
{scope}

Yêu cầu:
- Mỗi câu có đúng 4 lựa chọn, chỉ 1 đáp án đúng
- Lựa chọn không được trùng nhau
- Viết cùng ngôn ngữ với topic/reference (Việt hoặc Anh)
- Explanation ngắn (1 câu) giải thích tại sao đáp án đúng

Trả về JSON THUẦN TÚY (không có markdown, không có ```):
{{
  "questions": [
    {{
      "question": "<câu hỏi>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "correct_index": <0|1|2|3>,
      "explanation": "<giải thích ngắn>"
    }},
    ...
  ]
}}"""

    for llm_attempt in range(2):
        raw = await _call_gemini_with_retry(prompt, settings)
        try:
            data = _extract_json(raw)
            questions = data.get("questions", [])
            if not questions:
                raise ValueError("Không có câu hỏi nào trong response")
            validated = _validate_quiz_questions(questions)
            return validated
        except (json.JSONDecodeError, KeyError, ValueError) as exc:
            if llm_attempt == 0:
                logger.warning("Parse quiz JSON lần 1 thất bại: %s. Gọi lại LLM.", exc)
                continue
            logger.error("Parse quiz JSON vẫn thất bại sau retry LLM.")
            raise HTTPException(
                status_code=502,
                detail="Dịch vụ AI trả dữ liệu không hợp lệ. Vui lòng thử lại.",
            )

    raise HTTPException(status_code=502, detail="LLM thất bại sau retry.")


# ---------------------------------------------------------------------------
# Hàm gọi Gemini với retry khi 429 / 5xx
# ---------------------------------------------------------------------------

async def _call_gemini_with_retry(prompt: str, settings) -> str:
    """
    Gọi Gemini, retry tối đa 2 lần với backoff khi gặp lỗi tạm thời.
    Trả về chuỗi text thuần túy từ model.
    """
    client = genai.Client(api_key=settings.gemini_api_key)

    for attempt in range(3):
        try:
            t0 = time.perf_counter()
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=settings.llm_model,
                contents=prompt,
            )
            elapsed = (time.perf_counter() - t0) * 1000
            logger.debug("Gemini hoàn thành trong %.0f ms (model=%s)", elapsed, settings.llm_model)
            return response.text or ""

        except genai_errors.ClientError as exc:
            # 429 rate limit
            status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
            if status == 429 and attempt < 2:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("Gemini 429 rate limit. Retry %d/2 sau %.1fs.", attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("Gemini lỗi client: code=%s", status)
                raise HTTPException(
                    status_code=503,
                    detail="Dịch vụ AI đang quá tải. Vui lòng thử lại sau vài giây.",
                )
        except genai_errors.ServerError as exc:
            if attempt < 2:
                wait = _RETRY_BACKOFF[attempt]
                logger.warning("Gemini server error. Retry %d/2 sau %.1fs.", attempt + 1, wait)
                await asyncio.sleep(wait)
            else:
                logger.error("Gemini server error sau retry.")
                raise HTTPException(
                    status_code=503,
                    detail="Dịch vụ AI gặp lỗi. Vui lòng thử lại sau.",
                )
        except Exception as exc:
            logger.error("Lỗi không xác định khi gọi Gemini: %s", type(exc).__name__)
            raise HTTPException(
                status_code=503,
                detail="Dịch vụ AI gặp lỗi. Vui lòng thử lại sau.",
            )

    raise HTTPException(status_code=503, detail="LLM thất bại sau retry.")


# ---------------------------------------------------------------------------
# Utility: parse JSON từ chuỗi (xử lý trường hợp Gemini bọc trong ```json)
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict:
    """
    Trích JSON từ text, kể cả khi Gemini bọc trong ```json ... ``` hoặc ```.
    Raise json.JSONDecodeError nếu không tìm được JSON hợp lệ.
    """
    text = text.strip()
    # Xóa markdown code fence nếu có
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    return json.loads(text)


def _validate_flashcards(raw: list) -> list[dict]:
    """Validate và chuẩn hóa flashcards từ LLM."""
    result = []
    for item in raw:
        if isinstance(item, dict) and "question" in item and "answer" in item:
            result.append({
                "question": str(item["question"]).strip(),
                "answer": str(item["answer"]).strip(),
            })
    return result


def _validate_quiz_questions(questions: list) -> list[dict]:
    """
    Validate từng câu hỏi quiz:
    - Đúng 4 lựa chọn
    - Các lựa chọn không trùng nhau
    - correct_index trong [0, 3]
    - Thêm id tự động
    """
    validated = []
    for i, q in enumerate(questions):
        options = q.get("options", [])
        if len(options) != 4:
            raise ValueError(f"Câu hỏi {i+1} không có đúng 4 lựa chọn (có {len(options)})")
        # Kiểm tra trùng lựa chọn
        if len(set(options)) != 4:
            raise ValueError(f"Câu hỏi {i+1} có lựa chọn trùng nhau")
        correct_index = int(q.get("correct_index", -1))
        if correct_index not in (0, 1, 2, 3):
            raise ValueError(f"Câu hỏi {i+1} có correct_index không hợp lệ: {correct_index}")
        validated.append({
            "id": f"q{i+1}",
            "question": str(q["question"]).strip(),
            "options": [str(o).strip() for o in options],
            "correct_index": correct_index,
            "explanation": str(q.get("explanation", "")).strip(),
        })
    return validated
