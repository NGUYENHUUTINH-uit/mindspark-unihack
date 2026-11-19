@echo off
cd /d %~dp0
echo ========================================================
echo   MINDSPARK AI SERVICE (Feynman STT, Quiz, Oracle)
echo   Listening on: http://localhost:8000
echo   Docs:         http://localhost:8000/docs
echo ========================================================
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
pause
