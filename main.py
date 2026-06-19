from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import orders, copackers, formulas, seed, proof


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Halo Production Intelligence", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(copackers.router, prefix="/api/co-packers", tags=["co-packers"])
app.include_router(formulas.router, prefix="/api/formulas", tags=["formulas"])
app.include_router(seed.router, prefix="/api/seed", tags=["seed"])
app.include_router(proof.router, prefix="/api/proof", tags=["proof"])
