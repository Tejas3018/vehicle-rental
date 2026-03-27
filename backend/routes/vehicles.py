from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import os, shutil, uuid
from models.database import get_db, Vehicle, VehicleImage, Booking
from core.auth import get_current_user, require_role
from services.recommendation import get_recommendations, get_ai_trip_recommendation

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

UPLOAD_DIR = "./static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class VehicleCreate(BaseModel):
    type: str
    brand: str
    model: str
    fuel_type: str
    seating_capacity: int
    price_per_hour: float
    price_per_day: float
    registration_number: str
    fitness_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None
    city: Optional[str] = "Mumbai"


class VehicleUpdate(BaseModel):
    type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    fuel_type: Optional[str] = None
    seating_capacity: Optional[int] = None
    price_per_hour: Optional[float] = None
    price_per_day: Optional[float] = None
    status: Optional[str] = None
    fitness_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None


class AITripRequest(BaseModel):
    destination: str
    days: int
    people: int
    budget: float


def vehicle_to_dict(v: Vehicle) -> dict:
    return {
        "id": v.id, "type": v.type, "brand": v.brand, "model": v.model,
        "fuel_type": v.fuel_type, "seating_capacity": v.seating_capacity,
        "price_per_hour": v.price_per_hour, "price_per_day": v.price_per_day,
        "status": v.status, "registration_number": v.registration_number,
        "fitness_expiry": v.fitness_expiry, "insurance_expiry": v.insurance_expiry,
        "city": v.city, "rating": v.rating,
        "images": [img.image_path for img in v.images]
    }


@router.post("")
def add_vehicle(data: VehicleCreate, db: Session = Depends(get_db),
                _=Depends(require_role("admin"))):
    if db.query(Vehicle).filter(Vehicle.registration_number == data.registration_number).first():
        raise HTTPException(400, "Vehicle with this registration already exists")
    vehicle = Vehicle(**data.dict())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle_to_dict(vehicle)


@router.get("")
def list_vehicles(
    type: Optional[str] = None,
    fuel_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    seats: Optional[int] = None,
    city: Optional[str] = None,
    status: Optional[str] = "available",
    db: Session = Depends(get_db)
):
    q = db.query(Vehicle)
    if type: q = q.filter(Vehicle.type == type)
    if fuel_type: q = q.filter(Vehicle.fuel_type == fuel_type)
    if min_price: q = q.filter(Vehicle.price_per_day >= min_price)
    if max_price: q = q.filter(Vehicle.price_per_day <= max_price)
    if seats: q = q.filter(Vehicle.seating_capacity >= seats)
    if city: q = q.filter(Vehicle.city == city)
    if status: q = q.filter(Vehicle.status == status)
    return [vehicle_to_dict(v) for v in q.all()]


@router.get("/recommend")
def recommend_vehicles(
    budget: float = Query(...),
    passengers: int = Query(1),
    trip_type: str = Query("city"),
    duration_hours: float = Query(24),
    db: Session = Depends(get_db)
):
    vehicles = db.query(Vehicle).all()
    return get_recommendations(vehicles, budget, passengers, trip_type, duration_hours)


@router.post("/ai-recommend")
def ai_recommend(data: AITripRequest, db: Session = Depends(get_db)):
    if data.days <= 0:
        raise HTTPException(400, "Days must be greater than 0")
    if data.people <= 0:
        raise HTTPException(400, "People must be greater than 0")
    if data.budget <= 0:
        raise HTTPException(400, "Budget must be greater than 0")

    vehicles = db.query(Vehicle).all()
    try:
        return get_ai_trip_recommendation(
            vehicles=vehicles,
            destination=data.destination,
            days=data.days,
            people=data.people,
            budget=data.budget
        )
    except ValueError as e:
        raise HTTPException(500, str(e))
    except Exception:
        raise HTTPException(502, "Unable to generate AI recommendation at the moment")


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    return vehicle_to_dict(v)


@router.put("/{vehicle_id}")
def update_vehicle(vehicle_id: int, data: VehicleUpdate, db: Session = Depends(get_db),
                   _=Depends(require_role("admin", "fleet_manager"))):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    for k, val in data.dict(exclude_none=True).items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return vehicle_to_dict(v)


@router.delete("/{vehicle_id}")
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db),
                   _=Depends(require_role("admin"))):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    db.delete(v)
    db.commit()
    return {"message": "Vehicle deleted"}


@router.post("/{vehicle_id}/upload-image")
async def upload_image(vehicle_id: int, file: UploadFile = File(...),
                        db: Session = Depends(get_db),
                        _=Depends(require_role("admin", "fleet_manager"))):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    ext = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    img = VehicleImage(vehicle_id=vehicle_id, image_path=f"/static/images/{filename}")
    db.add(img)
    db.commit()
    return {"image_path": f"/static/images/{filename}"}


@router.get("/{vehicle_id}/availability")
def check_availability(vehicle_id: int, start: str, end: str, db: Session = Depends(get_db)):
    from datetime import datetime
    try:
        s = datetime.fromisoformat(start)
        e = datetime.fromisoformat(end)
    except:
        raise HTTPException(400, "Invalid date format. Use ISO format: YYYY-MM-DDTHH:MM:SS")
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    conflict = db.query(Booking).filter(
        Booking.vehicle_id == vehicle_id,
        Booking.status.in_(["booked", "picked_up"]),
        Booking.start_time < e,
        Booking.end_time > s
    ).first()
    return {"available": conflict is None, "vehicle_status": v.status}
