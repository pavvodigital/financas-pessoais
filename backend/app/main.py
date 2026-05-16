from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.database import SessionLocal
from app.seed import seed_categories
from app.auth import verify_token
from app.routers import auth as auth_router

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

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/dashboard", dependencies=[Depends(verify_token)])
def dashboard_placeholder():
    return {"message": "ok"}
