"""Seed the database with sample data"""
from models.database import Base, engine, SessionLocal, User, Vehicle, PricingRule
from core.auth import get_password_hash


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if already seeded
    if db.query(User).count() > 0:
        print("Database already seeded.")
        db.close()
        return
    
    # Users
    users = [
        User(name="Admin User", email="admin@rental.com", password=get_password_hash("admin123"), role="admin"),
        User(name="Fleet Manager", email="fleet@rental.com", password=get_password_hash("fleet123"), role="fleet_manager"),
        User(name="John Customer", email="john@example.com", password=get_password_hash("john123"), role="customer", license_number="DL1234567"),
        User(name="Jane Doe", email="jane@example.com", password=get_password_hash("jane123"), role="customer", license_number="DL7654321"),
    ]
    db.add_all(users)
    db.flush()
    
    # Vehicles
    vehicles = [
        Vehicle(type="car", brand="Maruti", model="Swift", fuel_type="petrol", seating_capacity=5,
                price_per_hour=150, price_per_day=1200, registration_number="MH01AB1234",
                city="Mumbai", rating=4.3, status="available"),
        Vehicle(type="car", brand="Hyundai", model="Creta", fuel_type="diesel", seating_capacity=5,
                price_per_hour=200, price_per_day=1800, registration_number="MH02CD5678",
                city="Mumbai", rating=4.6, status="available"),
        Vehicle(type="car", brand="Tata", model="Nexon EV", fuel_type="electric", seating_capacity=5,
                price_per_hour=220, price_per_day=2000, registration_number="MH03EF9012",
                city="Pune", rating=4.8, status="available"),
        Vehicle(type="bike", brand="Royal Enfield", model="Classic 350", fuel_type="petrol", seating_capacity=2,
                price_per_hour=80, price_per_day=700, registration_number="MH04GH3456",
                city="Mumbai", rating=4.5, status="available"),
        Vehicle(type="bike", brand="Honda", model="Activa 6G", fuel_type="petrol", seating_capacity=2,
                price_per_hour=50, price_per_day=400, registration_number="MH05IJ7890",
                city="Mumbai", rating=4.1, status="available"),
        Vehicle(type="van", brand="Force", model="Traveller", fuel_type="diesel", seating_capacity=12,
                price_per_hour=400, price_per_day=3500, registration_number="MH06KL1234",
                city="Mumbai", rating=4.2, status="available"),
        Vehicle(type="car", brand="Toyota", model="Innova Crysta", fuel_type="diesel", seating_capacity=7,
                price_per_hour=300, price_per_day=2800, registration_number="MH07MN5678",
                city="Pune", rating=4.7, status="available"),
        Vehicle(type="car", brand="Honda", model="City CNG", fuel_type="cng", seating_capacity=5,
                price_per_hour=130, price_per_day=1100, registration_number="MH08OP9012",
                city="Mumbai", rating=4.0, status="maintenance"),
    ]
    db.add_all(vehicles)
    db.flush()
    
    # Pricing rules
    rules = [
        PricingRule(rule_type="weekend", name="Weekend Surcharge", value=20, is_percentage=True,
                    conditions={}),
        PricingRule(rule_type="seasonal", name="Summer Peak", value=15, is_percentage=True,
                    conditions={"season": "summer"}),
        PricingRule(rule_type="seasonal", name="Monsoon Discount", value=-10, is_percentage=True,
                    conditions={"season": "monsoon"}),
        PricingRule(rule_type="coupon", name="Welcome Coupon", value=10, is_percentage=True,
                    conditions={"code": "WELCOME10"}),
        PricingRule(rule_type="coupon", name="Flat 200 Off", value=200, is_percentage=False,
                    conditions={"code": "FLAT200"}),
        PricingRule(rule_type="late_fee", name="Late Return Fee", value=150, is_percentage=False,
                    conditions={}),
    ]
    db.add_all(rules)
    db.commit()
    
    print("✅ Database seeded successfully!")
    print("   Admin: admin@rental.com / admin123")
    print("   Fleet: fleet@rental.com / fleet123")
    print("   Customer: john@example.com / john123")
    db.close()


if __name__ == "__main__":
    seed()
