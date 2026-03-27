from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models.database import Base, engine
from routes.auth import router as auth_router
from routes.vehicles import router as vehicle_router
from routes.bookings import router as booking_router
from routes.other import payment_router, maintenance_router, pricing_router, admin_router

# Create tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    from seed import seed

    seed()
    yield


app = FastAPI(
    title="Vehicle Rental Management Platform",
    description="Complete vehicle rental system with AI recommendations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files
os.makedirs("./static/images", exist_ok=True)
app.mount("/static", StaticFiles(directory="./static"), name="static")

# Routers
app.include_router(auth_router)
app.include_router(vehicle_router)
app.include_router(booking_router)
app.include_router(payment_router)
app.include_router(maintenance_router)
app.include_router(pricing_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "message": "Vehicle Rental Management Platform API",
        "docs": "/docs",
        "redoc": "/redoc"
    }

