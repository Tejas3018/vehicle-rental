@echo off
echo 🚗 VehicleRent Pro — Starting up...
echo.

echo 📦 Installing backend dependencies...
cd backend
pip install -r requirements.txt
echo ✅ Backend ready

echo 🚀 Starting FastAPI backend on http://localhost:8000...
start "VehicleRent Backend" cmd /k "uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak > nul

echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install
echo ✅ Frontend ready

echo 🎨 Starting React frontend on http://localhost:3000...
start "VehicleRent Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo ✅ VehicleRent Pro is running!
echo.
echo   Frontend:  http://localhost:3000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   Admin:    admin@rental.com / admin123
echo   Fleet:    fleet@rental.com / fleet123
echo   Customer: john@example.com / john123
echo ============================================
pause
