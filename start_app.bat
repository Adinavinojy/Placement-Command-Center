@echo off
echo Starting Placement Command Center (PCC)...
echo.

echo [1/2] Starting FastAPI Backend...
start cmd /k "cd backend && python -m uvicorn main:app"

echo [2/2] Starting React Frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo Both servers have been launched in separate windows!
echo - FastAPI Backend is running on http://127.0.0.1:8000
echo - React Frontend will open automatically in your browser (usually http://localhost:5173)
echo.
pause
