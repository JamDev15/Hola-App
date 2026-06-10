from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, close_db
from app.routers import orders, copackers, formulas, seed, proof


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()


app = FastAPI(title="Halo Production Intelligence", lifespan=lifespan)

# Allow React dev server (port 5173) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers only — React handles all page routing
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(copackers.router, prefix="/api/co-packers", tags=["co-packers"])
app.include_router(formulas.router, prefix="/api/formulas", tags=["formulas"])
app.include_router(seed.router, prefix="/api/seed", tags=["seed"])
app.include_router(proof.router, prefix="/api/proof", tags=["proof"])
