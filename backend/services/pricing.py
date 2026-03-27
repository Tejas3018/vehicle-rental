from datetime import datetime
from sqlalchemy.orm import Session
from models.database import PricingRule, Booking, Vehicle


def calculate_duration_hours(start: datetime, end: datetime) -> float:
    delta = end - start
    return delta.total_seconds() / 3600


def calculate_base_price(vehicle: Vehicle, start: datetime, end: datetime) -> float:
    hours = calculate_duration_hours(start, end)
    if hours >= 24:
        days = hours / 24
        return vehicle.price_per_day * days
    return vehicle.price_per_hour * hours


def is_weekend(dt: datetime) -> bool:
    return dt.weekday() >= 5  # Saturday=5, Sunday=6


def get_season(dt: datetime) -> str:
    month = dt.month
    if month in [12, 1, 2]:
        return "winter"
    elif month in [3, 4, 5]:
        return "summer"
    elif month in [6, 7, 8, 9]:
        return "monsoon"
    return "autumn"


def calculate_total_price(vehicle: Vehicle, start: datetime, end: datetime,
                           coupon_code: str = None, db: Session = None) -> dict:
    base = calculate_base_price(vehicle, start, end)
    weekend_surcharge = 0
    seasonal_adj = 0
    coupon_discount = 0
    
    rules = db.query(PricingRule).filter(PricingRule.is_active == True).all() if db else []
    
    for rule in rules:
        if rule.rule_type == "weekend" and (is_weekend(start) or is_weekend(end)):
            if rule.is_percentage:
                weekend_surcharge = base * (rule.value / 100)
            else:
                weekend_surcharge = rule.value
        
        elif rule.rule_type == "seasonal":
            conditions = rule.conditions or {}
            if conditions.get("season") == get_season(start):
                if rule.is_percentage:
                    seasonal_adj = base * (rule.value / 100)
                else:
                    seasonal_adj = rule.value
        
        elif rule.rule_type == "coupon" and coupon_code:
            conditions = rule.conditions or {}
            if conditions.get("code") == coupon_code:
                if rule.is_percentage:
                    coupon_discount = base * (rule.value / 100)
                else:
                    coupon_discount = rule.value
    
    total = base + weekend_surcharge + seasonal_adj - coupon_discount
    total = max(total, 0)
    
    return {
        "base_price": round(base, 2),
        "weekend_surcharge": round(weekend_surcharge, 2),
        "seasonal_adjustment": round(seasonal_adj, 2),
        "coupon_discount": round(coupon_discount, 2),
        "total": round(total, 2)
    }


def calculate_late_fee(booking: Booking, actual_return: datetime, db: Session) -> float:
    if actual_return <= booking.end_time:
        return 0
    late_hours = (actual_return - booking.end_time).total_seconds() / 3600
    late_rule = db.query(PricingRule).filter(
        PricingRule.rule_type == "late_fee",
        PricingRule.is_active == True
    ).first()
    if not late_rule:
        return round(late_hours * 100, 2)  # default ₹100/hr
    if late_rule.is_percentage:
        hourly = booking.total_cost / calculate_duration_hours(booking.start_time, booking.end_time)
        return round(late_hours * hourly * (late_rule.value / 100), 2)
    return round(late_hours * late_rule.value, 2)
