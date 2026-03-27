from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./rental.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, default="customer")  # admin/customer/fleet_manager
    license_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    bookings = relationship("Booking", back_populates="user")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False)  # car/bike/van
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    fuel_type = Column(String, nullable=False)  # petrol/diesel/electric/cng
    seating_capacity = Column(Integer, nullable=False)
    price_per_hour = Column(Float, nullable=False)
    price_per_day = Column(Float, nullable=False)
    status = Column(String, default="available")  # available/booked/maintenance
    registration_number = Column(String, unique=True)
    fitness_expiry = Column(String, nullable=True)
    insurance_expiry = Column(String, nullable=True)
    city = Column(String, default="Mumbai")
    rating = Column(Float, default=4.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    images = relationship("VehicleImage", back_populates="vehicle")
    bookings = relationship("Booking", back_populates="vehicle")
    maintenance_logs = relationship("MaintenanceLog", back_populates="vehicle")


class VehicleImage(Base):
    __tablename__ = "vehicle_images"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    image_path = Column(String, nullable=False)
    vehicle = relationship("Vehicle", back_populates="images")


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    total_cost = Column(Float, nullable=False)
    status = Column(String, default="booked")  # booked/picked_up/returned/cancelled
    payment_status = Column(String, default="pending")  # pending/paid/refunded
    payment_mode = Column(String, nullable=True)
    coupon_code = Column(String, nullable=True)
    discount_amount = Column(Float, default=0)
    late_fee = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    actual_return_time = Column(DateTime, nullable=True)
    user = relationship("User", back_populates="bookings")
    vehicle = relationship("Vehicle", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"))
    amount = Column(Float, nullable=False)
    status = Column(String, default="pending")  # pending/success/failed
    mode = Column(String, nullable=False)  # card/upi/cash/wallet
    transaction_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    booking = relationship("Booking", back_populates="payment")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    maintenance_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cost = Column(Float, nullable=False)
    next_due_date = Column(String, nullable=True)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    vehicle = relationship("Vehicle", back_populates="maintenance_logs")


class PricingRule(Base):
    __tablename__ = "pricing_rules"
    id = Column(Integer, primary_key=True, index=True)
    rule_type = Column(String, nullable=False)  # seasonal/weekend/coupon/late_fee
    name = Column(String, nullable=False)
    value = Column(Float, nullable=False)  # multiplier or flat amount
    is_percentage = Column(Boolean, default=True)
    conditions = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
