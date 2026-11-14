"""
samples/run_e2e_test.py — Kịch bản kiểm thử End-to-End tự động (Python / httpx).
Chạy được trên cả Windows, Linux và macOS.
Yêu cầu: Server ai-service đang chạy tại http://localhost:8000.

Chạy bằng: python samples/run_e2e_test.py
"""
import sys
import time
import httpx
from pathlib import Path

BASE_URL = "http://localhost:8000"
WALLET = "0x71C84517C37400E01f37500A405A429b62F34008"


def main():
    print("=" * 70)
    print("🚀 MINDPARK AI SERVICE — END-TO-END AUTOMATED TEST")
    print("=" * 70)

    with httpx.Client(base_url=BASE_URL, timeout=60.0) as client:
        # 1. Health check
        print("\n[1] Kiểm tra sức khỏe hệ thống: GET /health")
        try:
            res = client.get("/health")
            print(f"    Status: {res.status_code} | Body: {res.json()}")
        except Exception as e:
            print(f"❌ Không kết nối được server tại {BASE_URL}. Hãy bật server trước!")
            print("   Lệnh bật server: .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --port 8000")
            sys.exit(1)

        # 2. Mode A: Feynman Voice
        wav_path = Path(__file__).parent / "sample_test.wav"
        session_id_feynman = f"session-e2e-feynman-{int(time.time())}"
        print(f"\n[2] Test Chế độ A (Nói Feynman): POST /api/feynman/evaluate")
        print(f"    Session ID: {session_id_feynman}")

        with open(wav_path, "rb") as f:
            files = {"audio": (wav_path.name, f, "audio/wav")}
            data = {
                "wallet_address": WALLET,
                "session_id": session_id_feynman,
                "minutes_studied": "30",
                "topic": "Phương pháp học tập Feynman",
                "duration_seconds": "15",
            }
            res_feynman = client.post("/api/feynman/evaluate", data=data, files=files)
            print(f"    Status: {res_feynman.status_code}")
            feynman_json = res_feynman.json()
            print(f"    Passed: {feynman_json.get('passed')} | Score: {feynman_json.get('score')}")
            print(f"    Feedback: {feynman_json.get('feedback')}")
            if feynman_json.get("proof"):
                print(f"    Proof Signature: {feynman_json['proof']['signature'][:30]}...")
                print(f"    Proof Mock: {feynman_json['proof']['mock']}")

        # 3. Mode B: Quiz Generate & Submit
        session_id_quiz = f"session-e2e-quiz-{int(time.time())}"
        print(f"\n[3.1] Test Chế độ B (Sinh đề Quiz): POST /api/quiz/generate")
        print(f"    Session ID: {session_id_quiz}")
        gen_payload = {
            "session_id": session_id_quiz,
            "wallet_address": WALLET,
            "topic": "Thuật toán Dijkstra",
            "num_questions": 3,
        }
        res_gen = client.post("/api/quiz/generate", json=gen_payload)
        assert res_gen.status_code == 200, f"Generate quiz failed: {res_gen.text}"
        quiz_data = res_gen.json()
        quiz_id = quiz_data["quiz_id"]
        questions = quiz_data["questions"]
        print(f"    Quiz ID: {quiz_id} | Số câu hỏi: {len(questions)}")

        # 3.2 Submit Quiz
        print(f"\n[3.2] Test Chế độ B (Nộp bài Quiz): POST /api/quiz/submit")
        answers = [
            {"question_id": q["id"], "selected_index": 0}
            for q in questions
        ]
        sub_payload = {
            "quiz_id": quiz_id,
            "session_id": session_id_quiz,
            "wallet_address": WALLET,
            "minutes_studied": 45,
            "answers": answers,
        }
        res_sub = client.post("/api/quiz/submit", json=sub_payload)
        assert res_sub.status_code == 200, f"Submit quiz failed: {res_sub.text}"
        sub_json = res_sub.json()
        print(f"    Correct: {sub_json['correct']}/{sub_json['total']} | Score: {sub_json['score']}/10")
        print(f"    Passed: {sub_json['passed']} | Flashcards: {len(sub_json['flashcards'])}")

        # 4. Anti-replay check
        print(f"\n[4] Kiểm tra chống nộp lại cùng session_id (Phải trả về 409):")
        res_dup = client.post("/api/quiz/submit", json=sub_payload)
        print(f"    Status: {res_dup.status_code} (Mong đợi 404 hoặc 409 vì quiz_id đã bị xóa hoặc session có proof)")
        assert res_dup.status_code in (404, 409), f"Unexpected status: {res_dup.status_code}"

    print("\n" + "=" * 70)
    print("✅ TOÀN BỘ KỊCH BẢN KIỂM THỬ END-TO-END ĐÃ HOÀN TẤT VÀ CHÍNH XÁC!")
    print("=" * 70)


if __name__ == "__main__":
    main()
