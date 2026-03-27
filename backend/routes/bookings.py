from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.database import get_db, Booking, Vehicle, User, Payment
from core.auth import get_current_user, require_role
from services.pricing import calculate_total_price, calculate_late_fee

router = APIRouter(prefix="/bookings", tags=["Bookings"])


class BookingCreate(BaseModel):
    vehicle_id: int
    start_time: str
    end_time: str
    coupon_code: Optional[str] = None


class BookingExtend(BaseModel):
    new_end_time: str


def booking_to_dict(b: Booking) -> dict:
    return {
        "id": b.id, "user_id": b.user_id, "vehicle_id": b.vehicle_id,
        "start_time": b.start_time.isoformat(), "end_time": b.end_time.isoformat(),
        "total_cost": b.total_cost, "status": b.status,
        "payment_status": b.payment_status, "payment_mode": b.payment_mode,
        "coupon_code": b.coupon_code, "discount_amount": b.discount_amount,
        "late_fee": b.late_fee, "created_at": b.created_at.isoformat(),
        "vehicle": {
            "brand": b.vehicle.brand, "model": b.vehicle.model,
            "type": b.vehicle.type
        } if b.vehicle else None
    }


@router.post("")
def create_booking(data: BookingCreate, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    try:
        start = datetime.fromisoformat(data.start_time)
        end = datetime.fromisoformat(data.end_time)
    except:
        raise HTTPException(400, "Invalid date format")
    
    if start >= end:
        raise HTTPException(400, "End time must be after start time")
    if start < datetime.utcnow():
        raise HTTPException(400, "Start time cannot be in the past")
    
    vehicle = db.query(Vehicle).filter(Vehicle.id == data.vehicle_id).first()
    if not vehicle:
        raise HTTPException(404, "Vehicle not found")
    if vehicle.status != "available":
        raise HTTPException(400, f"Vehicle is {vehicle.status}")
    
    # Check time conflict
    conflict = db.query(Booking).filter(
        Booking.vehicle_id == data.vehicle_id,
        Booking.status.in_(["booked", "picked_up"]),
        Booking.start_time < end,
        Booking.end_time > start
    ).first()
    if conflict:
        raise HTTPException(400, "Vehicle not available for selected time slot")
    
    pricing = calculate_total_price(vehicle, start, end, data.coupon_code, db)
    
    booking = Booking(
        user_id=current_user.id,
        vehicle_id=data.vehicle_id,
        start_time=start,
        end_time=end,
        total_cost=pricing["total"],
        coupon_code=data.coupon_code,
        discount_amount=pricing["coupon_discount"]
    )
    vehicle.status = "booked"
    db.add(booking)
    db.commit()
    db.refresh(booking)
    
    return {**booking_to_dict(booking), "pricing_breakdown": pricing}


@router.get("/user/{user_id}")
def get_user_bookings(user_id: int, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    if current_user.role == "customer" and current_user.id != user_id:
        raise HTTPException(403, "Access denied")
    bookings = db.query(Booking).filter(Booking.user_id == user_id).all()
    return [booking_to_dict(b) for b in bookings]


@router.get("/all")
def get_all_bookings(db: Session = Depends(get_db),
                     _=Depends(require_role("admin"))):
    bookings = db.query(Booking).all()
    return [booking_to_dict(b) for b in bookings]


@router.get("/{booking_id}")
def get_booking(booking_id: int, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if current_user.role == "customer" and b.user_id != current_user.id:
        raise HTTPException(403, "Access denied")
    return booking_to_dict(b)


@router.put("/{booking_id}/pickup")
def pickup_vehicle(booking_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.user_id != current_user.id and current_user.role not in ["admin", "fleet_manager"]:
        raise HTTPException(403, "Access denied")
    if b.status != "booked":
        raise HTTPException(400, f"Cannot pickup. Booking status: {b.status}")
    if b.payment_status != "paid":
        raise HTTPException(400, "Payment must be completed before pickup")
    b.status = "picked_up"
    db.commit()
    return {"message": "Vehicle picked up", "status": b.status}


@router.put("/{booking_id}/return")
def return_vehicle(booking_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.status != "picked_up":
        raise HTTPException(400, f"Cannot return. Status: {b.status}")
    
    actual_return = datetime.utcnow()
    late_fee = calculate_late_fee(b, actual_return, db)
    
    b.actual_return_time = actual_return
    b.late_fee = late_fee
    b.status = "returned"
    b.vehicle.status = "available"
    db.commit()
    
    return {"message": "Vehicle returned", "late_fee": late_fee, "status": b.status}


@router.put("/{booking_id}/extend")
def extend_booking(booking_id: int, data: BookingExtend, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.user_id != current_user.id:
        raise HTTPException(403, "Access denied")
    if b.status not in ["booked", "picked_up"]:
        raise HTTPException(400, "Can only extend active bookings")
    
    try:
        new_end = datetime.fromisoformat(data.new_end_time)
    except:
        raise HTTPException(400, "Invalid date format")
    
    if new_end <= b.end_time:
        raise HTTPException(400, "New end time must be after current end time")
    
    extra_pricing = calculate_total_price(b.vehicle, b.end_time, new_end, None, db)
    b.total_cost += extra_pricing["total"]
    b.end_time = new_end
    db.commit()
    
    return {"message": "Booking extended", "extra_cost": extra_pricing["total"],
            "new_total": b.total_cost, "new_end_time": new_end.isoformat()}


@router.delete("/{booking_id}/cancel")
def cancel_booking(booking_id: int, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if b.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(403, "Access denied")
    if b.status in ["returned", "cancelled"]:
        raise HTTPException(400, f"Cannot cancel booking with status: {b.status}")
    
    b.status = "cancelled"
    b.vehicle.status = "available"
    if b.payment_status == "paid":
        b.payment_status = "refunded"
    db.commit()
    return {"message": "Booking cancelled"}
