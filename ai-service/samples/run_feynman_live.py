"""
samples/run_feynman_live.py — Script kiểm tra trực tiếp dịch vụ Gemini LLM (chấm điểm Feynman).
Sử dụng cấu hình từ file .env.
Chạy bằng: python samples/run_feynman_live.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Thêm đường dẫn gốc của ai-service vào sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.services.llm import evaluate_feynman


async def main():
    settings = get_settings()
    print("=" * 60)
    print(f"🧠 KIỂM TRA GEMINI FEYNMAN EVALUATOR")
    print(f"🤖 Model: {settings.llm_model}")
    print("=" * 60)

    # Test Case 1: Giải thích đạt chuẩn (Kỹ thuật Feynman)
    topic = "Kỹ thuật học Feynman (Feynman Learning Technique)"
    sample_transcript = (
        "Trong buổi học hôm nay, tôi đã tìm hiểu kỹ thuật Feynman. "
        "Bản chất của phương pháp này gồm 4 bước chính: "
        "Đầu tiên là chọn một chủ đề cần học. "
        "Thứ hai là giả vờ dạy lại chủ đề đó cho một đứa trẻ hoặc người mới bắt đầu bằng từ ngữ thật đơn giản. "
        "Thứ ba, khi gặp chỗ tắc hoặc khó giải thích, ta quay lại tài liệu để lấp đầy lỗ hổng kiến thức. "
        "Cuối cùng là tinh gọn và dùng các hình ảnh ẩn dụ trực quan để ghi nhớ lâu dài."
    )

    print(f"\n[Case 1] Gửi transcript hợp lệ ({len(sample_transcript.split())} từ)...")
    try:
        res1 = await evaluate_feynman(transcript=sample_transcript, topic=topic)
        print(f"⭐ Điểm: {res1.score}/10")
        print(f"💬 Nhận xét: {res1.feedback}")
        print(f"🚫 Nói nhảm (is_gibberish): {res1.is_gibberish}")
        print(f"🎴 Số Flashcards tạo ra: {len(res1.flashcards)}")
        for i, fc in enumerate(res1.flashcards, 1):
            print(f"   [{i}] Q: {fc['question']}")
            print(f"       A: {fc['answer']}")
    except Exception as exc:
        print(f"❌ Lỗi Case 1: {exc}")

    # Test Case 2: Đếm số vô nghĩa (Gibberish)
    gibberish_transcript = "Một hai ba bốn năm sáu bảy tám chín mười mười một mười hai mười ba mười bốn mười lăm."
    print(f"\n[Case 2] Gửi transcript đếm số vô nghĩa...")
    try:
        res2 = await evaluate_feynman(transcript=gibberish_transcript, topic=topic)
        print(f"⭐ Điểm: {res2.score}/10")
        print(f"💬 Nhận xét: {res2.feedback}")
        print(f"🚫 Nói nhảm (is_gibberish): {res2.is_gibberish}")
        if res2.is_gibberish or res2.score < 5.0:
            print("✅ Hệ thống đã phát hiện thành công nội dung không hợp lệ!")
    except Exception as exc:
        print(f"❌ Lỗi Case 2: {exc}")


if __name__ == "__main__":
    asyncio.run(main())

