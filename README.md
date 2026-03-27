# 🚗 VehicleRent Pro — Vehicle Rental Management Platform

A full-stack vehicle rental platform built with **FastAPI + React + SQLite**, featuring an **AI-powered travel + vehicle recommendation engine** with day-wise itinerary generation.

---

## 🏗️ Project Architecture

```
vehicle-rental/
├── backend/               # FastAPI Python Backend
│   ├── main.py            # App entry point
│   ├── seed.py            # Sample data seeder
│   ├── requirements.txt
│   ├── models/
│   │   └── database.py    # SQLAlchemy ORM models
│   ├── core/
│   │   └── auth.py        # JWT authentication
│   ├── routes/
│   │   ├── auth.py        # Signup/Login endpoints
│   │   ├── vehicles.py    # Vehicle CRUD + AI recommendations
│   │   ├── bookings.py    # Booking lifecycle management
│   │   └── other.py       # Payments, Maintenance, Pricing, Admin
│   ├── services/
│   │   ├── pricing.py     # Pricing engine (seasonal, weekend, coupons)
│   │   └── recommendation.py  # AI recommendation engine
│   └── static/images/     # Uploaded vehicle images
│
└── frontend/              # React + Vite Frontend
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx         # Auth context + routing
        └── pages/
            ├── Auth.jsx              # Login / Signup
            ├── CustomerDashboard.jsx # Browse, Book, AI Recommend
            ├── AdminDashboard.jsx    # Stats, Vehicles, Pricing
            └── FleetDashboard.jsx    # Maintenance, Status
```

---

## ⚙️ Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Backend   | FastAPI (Python 3.10+)            |
| Database  | SQLite via SQLAlchemy ORM         |
| Auth      | JWT (python-jose + bcrypt)        |
| Frontend  | React 18 + Vite                   |
| AI Engine | Rule-based + OpenAI itinerary planner |
| Images    | Static file serving (FastAPI)     |

---

## 🚀 Setup & Run

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

API will be live at: **http://localhost:8000**  
Swagger docs: **http://localhost:8000/docs**

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be live at: **http://localhost:3000**

---

## 👤 Demo Credentials

| Role         | Email                  | Password    |
|--------------|------------------------|-------------|
| Admin        | admin@rental.com       | admin123    |
| Fleet Manager| fleet@rental.com       | fleet123    |
| Customer     | john@example.com       | john123     |

---

## 🗄️ Database Schema

```
Users ──────────────────────────────────────────────────
  id, name, email, password, role, license_number

Vehicles ───────────────────────────────────────────────
  id, type, brand, model, fuel_type, seating_capacity,
  price_per_hour, price_per_day, status, registration_number,
  fitness_expiry, insurance_expiry, city, rating

VehicleImages ──────────────────────────────────────────
  id, vehicle_id → Vehicles, image_path

Bookings ───────────────────────────────────────────────
  id, user_id → Users, vehicle_id → Vehicles,
  start_time, end_time, total_cost, status,
  payment_status, coupon_code, discount_amount, late_fee

Payments ───────────────────────────────────────────────
  id, booking_id → Bookings, amount, status, mode, transaction_id

MaintenanceLogs ────────────────────────────────────────
  id, vehicle_id → Vehicles, maintenance_type,
  description, cost, next_due_date, performed_by

PricingRules ───────────────────────────────────────────
  id, rule_type, name, value, is_percentage, conditions (JSON)
```

---

## 📡 API Endpoints

### Auth
| Method | Endpoint        | Access   |
|--------|----------------|----------|
| POST   | /auth/signup   | Public   |
| POST   | /auth/login    | Public   |
| GET    | /auth/me       | All      |

### Vehicles
| Method | Endpoint                          | Access            |
|--------|----------------------------------|-------------------|
| GET    | /vehicles                        | All               |
| POST   | /vehicles                        | Admin             |
| GET    | /vehicles/{id}                   | All               |
| PUT    | /vehicles/{id}                   | Admin/Fleet       |
| DELETE | /vehicles/{id}                   | Admin             |
| GET    | /vehicles/recommend              | All               |
| POST   | /vehicles/ai-recommend           | All               |
| GET    | /vehicles/{id}/availability      | All               |
| POST   | /vehicles/{id}/upload-image      | Admin/Fleet       |

### Bookings
| Method | Endpoint                         | Access            |
|--------|----------------------------------|-------------------|
| POST   | /bookings                        | Customer          |
| GET    | /bookings/user/{user_id}         | Customer/Admin    |
| GET    | /bookings/all                    | Admin             |
| GET    | /bookings/{id}                   | Owner/Admin       |
| PUT    | /bookings/{id}/pickup            | Customer/Admin    |
| PUT    | /bookings/{id}/return            | Customer/Admin    |
| PUT    | /bookings/{id}/extend            | Customer          |
| DELETE | /bookings/{id}/cancel            | Customer/Admin    |

### Payments
| Method | Endpoint                 | Access      |
|--------|--------------------------|-------------|
| POST   | /payments/create-order   | Customer    |
| POST   | /payments/verify         | Customer    |
| POST   | /payments/webhook        | Razorpay    |

### Maintenance
| Method | Endpoint                     | Access       |
|--------|------------------------------|--------------|
| POST   | /maintenance                 | Admin/Fleet  |
| GET    | /maintenance                 | Admin/Fleet  |
| GET    | /maintenance/{vehicle_id}    | Admin/Fleet  |

### Pricing Rules
| Method | Endpoint              | Access  |
|--------|-----------------------|---------|
| POST   | /pricing-rules        | Admin   |
| GET    | /pricing-rules        | All     |
| DELETE | /pricing-rules/{id}   | Admin   |

### Admin
| Method | Endpoint       | Access |
|--------|----------------|--------|
| GET    | /admin/stats   | Admin  |
| GET    | /admin/users   | Admin  |

---

## 🤖 AI Recommendation Engine

The platform now supports two recommendation modes:

1. **Score-based recommender** (fast deterministic ranking)
```
score = budget_fit (0-30) + seat_match (0-25) + trip_type_match (0-25)
      + fuel_efficiency (0-10) + rating (0-10)
```
Usage:
```
GET /vehicles/recommend?budget=2000&passengers=2&trip_type=city&duration_hours=24
```

2. **OpenAI trip planner with itinerary**
- Returns best vehicle type, specific vehicle example, reason, estimated cost, fuel type, and day-wise itinerary.
- Enforces budget-safe output and realistic India-focused recommendations.

Usage:
```
POST /vehicles/ai-recommend
Content-Type: application/json

{
  "destination": "Goa",
  "days": 3,
  "people": 2,
  "budget": 8000
}
```

Response shape:
```
{
  "vehicle_type": "",
  "vehicle_example": "",
  "reason": "",
  "estimated_cost": 0,
  "fuel_type": "",
  "itinerary": ["", "", ""]
}
```

> Required backend env: `OPENAI_API_KEY`

---

## 💰 Pricing Engine

```
Total = base_price + weekend_surcharge + seasonal_adjustment
        - coupon_discount + late_return_fee
```

**Default Coupons (seeded):**
- `WELCOME10` → 10% off
- `FLAT200` → ₹200 flat off

**Default Rules:**
- Weekend: +20%
- Summer season: +15%
- Monsoon season: -10%
- Late return: ₹150/hour

---

## 🔄 Booking Lifecycle

```
BOOKED → [Pay] → BOOKED (paid) → [Pickup] → PICKED_UP → [Return] → RETURNED
                                                        ↘ [Extend] → new end_time
BOOKED/PICKED_UP → [Cancel] → CANCELLED
```

