import json
import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from openai import OpenAI

from models.database import Vehicle

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def score_vehicle(vehicle: Vehicle, budget_per_day: float, passengers: int,
                  trip_type: str, duration_hours: float) -> float:
    score = 0.0
    cost = vehicle.price_per_day if duration_hours >= 24 else vehicle.price_per_hour * duration_hours
    if cost <= budget_per_day * (duration_hours / 24 if duration_hours >= 24 else 1):
        budget_ratio = cost / (budget_per_day * max(duration_hours / 24, 1))
        score += 30 * (1 - abs(1 - budget_ratio))
    if vehicle.seating_capacity >= passengers:
        over = vehicle.seating_capacity - passengers
        score += 25 * max(0, 1 - over * 0.15)
    if trip_type == "city":
        if vehicle.type == "bike": score += 25
        elif vehicle.type == "car" and vehicle.fuel_type in ["electric", "cng"]: score += 20
        elif vehicle.type == "car": score += 15
    elif trip_type == "highway":
        if vehicle.type == "car" and vehicle.fuel_type == "diesel": score += 25
        elif vehicle.type == "van": score += 18
        elif vehicle.type == "car": score += 20
    elif trip_type == "long_trip":
        if vehicle.type == "van": score += 25
        elif vehicle.type == "car" and vehicle.seating_capacity >= 5: score += 22
        elif vehicle.type == "car": score += 15
    score += {"electric": 10, "cng": 8, "petrol": 5, "diesel": 4}.get(vehicle.fuel_type, 5)
    score += (vehicle.rating / 5) * 10
    return round(score, 2)


def get_recommendations(vehicles: List[Vehicle], budget_per_day: float,
                        passengers: int, trip_type: str = "city",
                        duration_hours: float = 24, top_n: int = 3) -> List[dict]:
    available = [v for v in vehicles if v.status == "available"]
    scored = []
    for v in available:
        s = score_vehicle(v, budget_per_day, passengers, trip_type, duration_hours)
        scored.append({"vehicle_id": v.id, "brand": v.brand, "model": v.model, "type": v.type,
                       "fuel_type": v.fuel_type, "seating_capacity": v.seating_capacity,
                       "price_per_day": v.price_per_day, "price_per_hour": v.price_per_hour,
                       "rating": v.rating, "ai_score": s,
                       "match_reason": _get_reason(v, trip_type, passengers)})
    scored.sort(key=lambda x: x["ai_score"], reverse=True)
    return scored[:top_n]


def get_ai_trip_recommendation(vehicles: List[Vehicle], destination: str, days: int,
                               people: int, budget: float) -> dict:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OPENAI_API_KEY is not configured")

    client = OpenAI(api_key=key)
    available = [v for v in vehicles if v.status == "available"][:20]
    catalog = [{"type": v.type, "brand": v.brand, "model": v.model, "fuel_type": v.fuel_type,
                "seating_capacity": v.seating_capacity, "price_per_day": v.price_per_day} for v in available]

    prompt = f"""
You are an intelligent travel and vehicle recommendation assistant for a vehicle rental platform.
Return only valid JSON with keys: vehicle_type, vehicle_example, reason, estimated_cost, fuel_type, itinerary.
Rules: realistic for India, budget must be respected, vehicle must fit people and trip.
Input: Destination={destination}, Days={days}, People={people}, Budget={budget}
Available vehicles: {json.dumps(catalog)}
Ensure itinerary has exactly {max(days, 1)} day-wise items.
"""
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}]
    )
    data = json.loads(res.choices[0].message.content)
    itinerary = data.get("itinerary") if isinstance(data.get("itinerary"), list) else []
    if len(itinerary) < max(days, 1):
        itinerary += [f"Day {i + 1}: Free exploration in {destination}" for i in range(len(itinerary), max(days, 1))]
    data["itinerary"] = itinerary[:max(days, 1)]
    data["estimated_cost"] = min(float(data.get("estimated_cost", budget)), float(budget))
    return data


def _get_reason(v: Vehicle, trip_type: str, passengers: int) -> str:
    reasons = []
    if v.fuel_type == "electric": reasons.append("Eco-friendly & low running cost")
    if v.seating_capacity >= passengers + 2: reasons.append(f"Comfortable for {passengers} passengers")
    if trip_type == "city" and v.type == "bike": reasons.append("Perfect for city commute")
    if trip_type == "highway" and v.fuel_type == "diesel": reasons.append("Great fuel efficiency on highways")
    if v.rating >= 4.5: reasons.append("Highly rated by customers")
    return "; ".join(reasons) if reasons else "Good overall match"
