"""
samples/run_stt_sample.py — Script kiểm tra trực tiếp dịch vụ STT với file mẫu.
Chạy bằng: python samples/run_stt_sample.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Thêm đường dẫn gốc của ai-service vào sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.services.stt import transcribe


async def main():
    wav_path = Path(__file__).parent / "sample_test.wav"
    if not wav_path.exists():
        print(f"❌ Không tìm thấy file âm thanh mẫu: {wav_path}")
        return

    file_size_bytes = wav_path.stat().st_size
    print(f"🎵 Đang kiểm tra file: {wav_path.name} ({file_size_bytes / 1024:.1f} KB)")

    with open(wav_path, "rb") as f:
        audio_bytes = f.read()

    settings = get_settings()
    print(f"🚀 Gửi tới Groq Whisper (model: {settings.stt_model})...")

    try:
        transcript = await transcribe(audio_bytes, filename=wav_path.name)
        word_count = len(transcript.split())

        print("\n" + "=" * 50)
        print("📝 KẾT QUẢ TRANSCRIPTION:")
        print(f"\"{transcript}\"")
        print("=" * 50)
        print(f"📊 Thống kê: {word_count} từ")
        if word_count >= 15:
            print("✅ ĐẠT: Số từ >= 15 từ theo tiêu chuẩn MindSpark.")
        else:
            print("⚠️ CHƯA ĐẠT: Số từ < 15 từ.")
    except Exception as exc:
        print(f"❌ Gặp lỗi khi gọi STT: {exc}")


if __name__ == "__main__":
    asyncio.run(main())

