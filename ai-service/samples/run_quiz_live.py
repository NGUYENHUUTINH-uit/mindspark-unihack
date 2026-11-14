"""
samples/run_quiz_live.py — Script kiểm tra trực tiếp Chế độ B: Quiz Trắc nghiệm.
Sử dụng cấu hình từ file .env.
Chạy bằng: python samples/run_quiz_live.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Thêm đường dẫn gốc của ai-service vào sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.services import llm as llm_service
from app.services import quiz as quiz_service
from app.services import session_store
from app.schemas import AnswerItem


async def main():
    settings = get_settings()
    print("=" * 65)
    print("🎯 KIỂM TRA CHẾ ĐỘ B: QUIZ TRẮC NGHIỆM (GENERATE & SUBMIT)")
    print(f"🤖 Model: {settings.llm_model}")
    print("=" * 65)

    topic = "Thuật toán Dijkstra (Tìm đường đi ngắn nhất)"
    reference_text = (
        "Thuật toán Dijkstra là thuật toán tìm đường đi ngắn nhất từ một đỉnh nguồn "
        "đến tất cả các đỉnh còn lại trong đồ thị có trọng số không âm. "
        "Thuật toán sử dụng cấu trúc hàng đợi ưu tiên (Priority Queue / Min-Heap) để đạt độ phức tạp O((V + E) log V). "
        "Dijkstra không hoạt động đúng nếu đồ thị chứa trọng số âm."
    )

    print(f"\n[Bước 1] Yêu cầu Gemini sinh 3 câu trắc nghiệm dựa trên tài liệu...")
    try:
        raw_quiz = await llm_service.generate_quiz(
            topic=topic,
            reference_text=reference_text,
            num_questions=3,
        )
        print(f"✅ Đã sinh thành công {len(raw_quiz)} câu hỏi.")

        # Xáo trộn đáp án
        shuffled = quiz_service.shuffle_options(raw_quiz)
        quiz_id = session_store.create_quiz(shuffled, topic=topic)
        print(f"💾 Đã lưu vào Server Store (quiz_id: {quiz_id}, TTL: 30 phút).")

        print("\n--- ĐỀ THI TRẮC NGHIỆM HIỂN THỊ CHO NGƯỜI HỌC (Không có đáp án) ---")
        for i, q in enumerate(shuffled, 1):
            print(f"\nCâu {i}: {q['question']}")
            for opt_idx, opt_text in enumerate(q['options']):
                label = chr(65 + opt_idx)  # A, B, C, D
                print(f"   [{label}] {opt_text}")

        # Giả lập người học làm bài:
        # Chọn đúng câu 1, đúng câu 2, cố tình chọn sai câu 3
        print("\n" + "=" * 65)
        print("[Bước 2] Giả lập người học nộp bài:")
        answers = [
            AnswerItem(question_id=shuffled[0]["id"], selected_index=shuffled[0]["correct_index"]),
            AnswerItem(question_id=shuffled[1]["id"], selected_index=shuffled[1]["correct_index"]),
            AnswerItem(question_id=shuffled[2]["id"], selected_index=(shuffled[2]["correct_index"] + 1) % 4),  # chọn sai
        ]
        print(f"   - Câu 1: Chọn đúng ({shuffled[0]['options'][shuffled[0]['correct_index']]})")
        print(f"   - Câu 2: Chọn đúng ({shuffled[1]['options'][shuffled[1]['correct_index']]})")
        print(f"   - Câu 3: Chọn sai")

        # Chấm bài
        grade_result = quiz_service.grade(quiz_data=shuffled, answers=answers)
        correct = grade_result["correct"]
        total = grade_result["total"]
        ratio = correct / total
        score10 = round(ratio * 10, 1)
        passed = ratio >= 0.6

        print("\n--- KẾT QUẢ CHẤM ĐIỂM ---")
        print(f"📊 Kết quả: {correct}/{total} câu ({ratio*100:.0f}%)")
        print(f"⭐ Điểm: {score10}/10")
        print(f"🏆 Trạng thái: {'✅ ĐẠT (Passed)' if passed else '❌ CHƯA ĐẠT (Failed)'}")

        # Flashcards ôn tập
        flashcards = quiz_service.build_flashcards(wrong_items=grade_result["wrong_items"], topic=topic)
        print(f"\n🎴 Flashcards được sinh ra để ôn tập ({len(flashcards)} thẻ):")
        for idx, fc in enumerate(flashcards, 1):
            print(f"   [{idx}] Q: {fc['question']}")
            print(f"       A: {fc['answer']}")

    except Exception as exc:
        print(f"❌ Gặp lỗi: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
