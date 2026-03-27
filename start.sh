#!/bin/bash
# VehicleRent Pro — Quick Start Script

echo "🚗 VehicleRent Pro — Starting up..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.10+"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Backend setup
echo "📦 Installing backend dependencies..."
cd backend
pip install -r requirements.txt -q
echo "✅ Backend dependencies installed"

# Start backend in background
echo "🚀 Starting FastAPI backend on http://localhost:8000 ..."
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Frontend setup
echo ""
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install --silent
echo "✅ Frontend dependencies installed"

echo "🎨 Starting React frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "✅ VehicleRent Pro is running!"
echo ""
echo "  🌐 Frontend:  http://localhost:3000"
echo "  🔧 API:       http://localhost:8000"
echo "  📚 API Docs:  http://localhost:8000/docs"
echo ""
echo "  Demo Logins:"
echo "  👑 Admin:    admin@rental.com / admin123"
echo "  🔧 Fleet:    fleet@rental.com / fleet123"
echo "  👤 Customer: john@example.com / john123"
echo "============================================"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
