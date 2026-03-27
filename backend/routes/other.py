from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import hashlib
import hmac
import json
import os
import uuid
import razorpay
from dotenv import load_dotenv
from models.database import get_db, Payment, Booking, MaintenanceLog, Vehicle, PricingRule, User
from core.auth import get_current_user, require_role

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

# ---- PAYMENTS ----
payment_router = APIRouter(prefix="/payments", tags=["Payments"])


class CreateOrderRequest(BaseModel):
    booking_id: int


class VerifyPaymentRequest(BaseModel):
    booking_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def get_razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(500, "Razorpay keys are not configured")
    return razorpay.Client(auth=(key_id, key_secret)), key_id, key_secret


@payment_router.post("/create-order")
def create_order(data: CreateOrderRequest, db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Access denied")
    if booking.payment_status == "paid":
        raise HTTPException(400, "Already paid")

    amount_rupees = round((booking.total_cost or 0) + (booking.late_fee or 0), 2)
    amount_paise = int(amount_rupees * 100)
    if amount_paise <= 0:
        raise HTTPException(400, "Invalid payable amount")

    client, key_id, _ = get_razorpay_client()
    try:
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"booking_{booking.id}_{uuid.uuid4().hex[:8]}",
            "notes": {"booking_id": str(booking.id), "user_id": str(current_user.id)}
        })
    except Exception:
        raise HTTPException(502, "Unable to create payment order")

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if not payment:
        payment = Payment(booking_id=booking.id, amount=amount_rupees, status="pending", mode="razorpay", transaction_id=order["id"])
        db.add(payment)
    else:
        payment.amount = amount_rupees
        payment.status = "pending"
        payment.mode = "razorpay"
        payment.transaction_id = order["id"]

    db.commit()
    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": key_id,
        "booking_id": booking.id,
        "name": "VehicleRent Pro",
        "description": f"Booking #{booking.id} payment",
        "prefill": {"name": current_user.name, "email": current_user.email}
    }


@payment_router.post("/verify")
def verify_payment(data: VerifyPaymentRequest, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    booking = db.query(Booking).filter(Booking.id == data.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Access denied")

    _, _, key_secret = get_razorpay_client()
    payload = f"{data.razorpay_order_id}|{data.razorpay_payment_id}".encode()
    generated = hmac.new(key_secret.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(generated, data.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")

    payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
    if not payment:
        payment = Payment(
            booking_id=booking.id,
            amount=round((booking.total_cost or 0) + (booking.late_fee or 0), 2),
            status="success",
            mode="razorpay",
            transaction_id=data.razorpay_payment_id
        )
        db.add(payment)
    else:
        payment.status = "success"
        payment.mode = "razorpay"
        payment.transaction_id = data.razorpay_payment_id

    booking.payment_status = "paid"
    booking.payment_mode = "razorpay"
    db.commit()

    return {
        "transaction_id": data.razorpay_payment_id,
        "amount": payment.amount,
        "status": payment.status,
        "mode": payment.mode,
        "message": "Payment verified and completed"
    }


@payment_router.post("/webhook")
async def razorpay_webhook(request: Request, x_razorpay_signature: str = Header(default=""),
                           db: Session = Depends(get_db)):
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(500, "Webhook secret is not configured")

    body = await request.body()
    expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_razorpay_signature):
        raise HTTPException(400, "Invalid webhook signature")

    payload = json.loads(body.decode("utf-8"))
    event = payload.get("event")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    notes = payment_entity.get("notes", {})
    booking_id = notes.get("booking_id")

    if not booking_id:
        return {"ok": True}

    booking = db.query(Booking).filter(Booking.id == int(booking_id)).first()
    if not booking:
        return {"ok": True}

    if event == "payment.captured":
        payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()
        amount = round((payment_entity.get("amount", 0) / 100), 2) or round((booking.total_cost or 0) + (booking.late_fee or 0), 2)
        if not payment:
            payment = Payment(
                booking_id=booking.id,
                amount=amount,
                status="success",
                mode="razorpay",
                transaction_id=payment_entity.get("id")
            )
            db.add(payment)
        else:
            payment.amount = amount
            payment.status = "success"
            payment.mode = "razorpay"
            payment.transaction_id = payment_entity.get("id") or payment.transaction_id

        booking.payment_status = "paid"
        booking.payment_mode = "razorpay"
        db.commit()

    elif event == "payment.failed" and booking.payment_status != "paid":
        booking.payment_status = "pending"
        db.commit()

    return {"ok": True}


# ---- MAINTENANCE ----
maintenance_router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


class MaintenanceCreate(BaseModel):
    vehicle_id: int
    maintenance_type: str
    description: Optional[str] = None
    cost: float
    next_due_date: Optional[str] = None


@maintenance_router.post("")
def log_maintenance(data: MaintenanceCreate, db: Session = Depends(get_db),
                    current_user: User = Depends(require_role("admin", "fleet_manager"))):
    v = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    log = MaintenanceLog(**data.dict(), performed_by=current_user.id)
    v.status = "maintenance"
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "vehicle_id": log.vehicle_id, "type": log.maintenance_type,
            "cost": log.cost, "next_due_date": log.next_due_date}


@maintenance_router.get("/{vehicle_id}")
def get_maintenance(vehicle_id: int, db: Session = Depends(get_db),
                    _=Depends(require_role("admin", "fleet_manager"))):
    logs = db.query(MaintenanceLog).filter(MaintenanceLog.vehicle_id == vehicle_id).all()
    return [{"id": l.id, "type": l.maintenance_type, "description": l.description,
             "cost": l.cost, "next_due_date": l.next_due_date,
             "date": l.created_at.isoformat()} for l in logs]


@maintenance_router.get("")
def get_all_maintenance(db: Session = Depends(get_db),
                        _=Depends(require_role("admin", "fleet_manager"))):
    logs = db.query(MaintenanceLog).all()
    return [{"id": l.id, "vehicle_id": l.vehicle_id, "type": l.maintenance_type,
             "cost": l.cost, "date": l.created_at.isoformat()} for l in logs]


# ---- PRICING RULES ----
pricing_router = APIRouter(prefix="/pricing-rules", tags=["Pricing"])


class PricingRuleCreate(BaseModel):
    rule_type: str
    name: str
    value: float
    is_percentage: Optional[bool] = True
    conditions: Optional[dict] = None


@pricing_router.post("")
def create_rule(data: PricingRuleCreate, db: Session = Depends(get_db),
                _=Depends(require_role("admin"))):
    rule = PricingRule(**data.dict())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "type": rule.rule_type, "name": rule.name,
            "value": rule.value, "is_percentage": rule.is_percentage}


@pricing_router.get("")
def get_rules(db: Session = Depends(get_db)):
    rules = db.query(PricingRule).filter(PricingRule.is_active == True).all()
    return [{"id": r.id, "type": r.rule_type, "name": r.name, "value": r.value,
             "is_percentage": r.is_percentage, "conditions": r.conditions} for r in rules]


@pricing_router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db),
                _=Depends(require_role("admin"))):
    r = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not r:
        raise HTTPException(404, "Rule not found")
    r.is_active = False
    db.commit()
    return {"message": "Rule deactivated"}


# ---- ADMIN ----
admin_router = APIRouter(prefix="/admin", tags=["Admin"])


@admin_router.get("/stats")
def get_stats(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    from models.database import Booking, Vehicle, User
    total_revenue = db.query(Payment).filter(Payment.status == "success").all()
    revenue_sum = sum(p.amount for p in total_revenue)
    active_rentals = db.query(Booking).filter(Booking.status.in_(["booked", "picked_up"])).count()
    total_vehicles = db.query(Vehicle).count()
    available = db.query(Vehicle).filter(Vehicle.status == "available").count()
    in_maintenance = db.query(Vehicle).filter(Vehicle.status == "maintenance").count()
    total_users = db.query(User).filter(User.role == "customer").count()
    total_bookings = db.query(Booking).count()
    
    return {
        "total_revenue": round(revenue_sum, 2),
        "active_rentals": active_rentals,
        "total_vehicles": total_vehicles,
        "available_vehicles": available,
        "maintenance_vehicles": in_maintenance,
        "total_customers": total_users,
        "total_bookings": total_bookings
    }


@admin_router.get("/users")
def get_users(db: Session = Depends(get_db), _=Depends(require_role("admin"))):
    users = db.query(User).all()
    return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role,
             "created_at": u.created_at.isoformat()} for u in users]
