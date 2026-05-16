from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal
from app.seed import seed_categories
from app.routers import auth as auth_router
from app.routers import upload as upload_router
from app.routers import dashboard as dashboard_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
    yield

app = FastAPI(title="Finanças", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(upload_router.router)
app.include_router(dashboard_router.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
