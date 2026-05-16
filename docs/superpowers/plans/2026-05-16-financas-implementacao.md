# Sistema de Finanças Pessoais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app de finanças pessoais com importação de PDFs Itaú, auto-categorização, dashboards e planos de economia.

**Architecture:** FastAPI (Python) backend com PostgreSQL via SQLAlchemy; React + Recharts + Tailwind frontend; nginx + Docker Compose no VPS.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, pdfplumber, python-jose (JWT), React 18, Vite, Recharts, Tailwind CSS, PostgreSQL 16, Docker Compose, nginx

---

## File Structure

```
finanças/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + CORS + routers
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Engine + SessionLocal + Base
│   │   ├── auth.py              # JWT create/verify + dependency
│   │   ├── seed.py              # Default categories + rules
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── category.py      # Category, CategoryRule
│   │   │   ├── transaction.py   # Transaction, UploadedFile
│   │   │   └── plan.py          # SavingsPlan, PlanCategoryBudget
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── category.py
│   │   │   ├── transaction.py
│   │   │   ├── dashboard.py
│   │   │   ├── plan.py
│   │   │   └── trends.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── upload.py
│   │   │   ├── dashboard.py
│   │   │   ├── transactions.py
│   │   │   ├── categories.py
│   │   │   ├── trends.py
│   │   │   └── plans.py
│   │   └── services/
│   │       ├── pdf_parser.py    # Parse extrato + fatura Itaú
│   │       ├── categorizer.py   # Keyword matching + Itaú map
│   │       └── trends.py        # Aggregation logic
│   ├── tests/
│   │   ├── conftest.py          # Test DB + TestClient + fixtures
│   │   ├── test_auth.py
│   │   ├── test_pdf_parser.py
│   │   ├── test_categorizer.py
│   │   ├── test_upload.py
│   │   ├── test_dashboard.py
│   │   ├── test_transactions.py
│   │   ├── test_categories.py
│   │   ├── test_trends.py
│   │   └── test_plans.py
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx              # BrowserRouter + AuthGuard + routes
│   │   ├── api/client.ts        # axios + JWT interceptor
│   │   ├── store/person.ts      # Zustand: diogo|lis|ambos
│   │   ├── types/index.ts
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Import.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── Plans.tsx
│   │   │   └── Trends.tsx
│   │   └── components/
│   │       ├── Layout/Sidebar.tsx
│   │       ├── Layout/PersonFilter.tsx
│   │       ├── Dashboard/SummaryCards.tsx
│   │       ├── Dashboard/CategoryPieChart.tsx
│   │       ├── Dashboard/MonthlyBarChart.tsx
│   │       ├── Import/DropZone.tsx
│   │       ├── Import/PreviewTable.tsx
│   │       ├── Plans/CategoryProgressBar.tsx
│   │       └── Trends/TrendBarChart.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## Phase 1: Infrastructure

### Task 1: Project structure + environment

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/config.py`
- Create: `backend/app/database.py`
- Create: `backend/app/main.py`
- Create: `.env.example`

- [ ] **Step 1: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
pydantic-settings==2.2.1
pdfplumber==0.11.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
psycopg2-binary==2.9.9
pytest==8.2.0
pytest-asyncio==0.23.6
httpx==0.27.0
```

- [ ] **Step 2: Create backend/app/config.py**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://financas:financas@db:5432/financas"
    app_password: str = "changeme"
    secret_key: str = "changeme-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Step 3: Create backend/app/database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Create backend/app/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Finanças")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Create .env.example**

```
DATABASE_URL=postgresql://financas:financas@db:5432/financas
APP_PASSWORD=suasenha
SECRET_KEY=gere-uma-chave-aleatoria-aqui
```

- [ ] **Step 6: Create backend/tests/conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db

TEST_DB = "sqlite:///./test.db"
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)
```

- [ ] **Step 7: Test health endpoint**

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Expected: 0 tests collected, no errors. Then run manually:
```bash
uvicorn app.main:app --reload
curl http://localhost:8000/api/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 8: Commit**
```bash
git add backend/ .env.example
git commit -m "feat: backend skeleton FastAPI + config + database"
```

---

### Task 2: Database models + Alembic migrations

**Files:**
- Create: `backend/app/models/category.py`
- Create: `backend/app/models/transaction.py`
- Create: `backend/app/models/plan.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/alembic.ini` + `backend/alembic/`

- [ ] **Step 1: Create backend/app/models/category.py**

```python
import uuid
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Category(Base):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#7c6af7")
    icon: Mapped[str] = mapped_column(String(50), default="❓")
    monthly_budget: Mapped[float | None] = mapped_column(nullable=True)
    rules: Mapped[list["CategoryRule"]] = relationship(back_populates="category", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")

class CategoryRule(Base):
    __tablename__ = "category_rules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(200), nullable=False)
    match_type: Mapped[str] = mapped_column(SAEnum("contains", "starts_with", "exact", name="match_type"), default="contains")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped["Category"] = relationship(back_populates="rules")
```

- [ ] **Step 2: Create backend/app/models/transaction.py**

```python
import uuid
from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, ForeignKey, Boolean, Enum as SAEnum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(SAEnum("statement", "credit_card", name="file_type"))
    person: Mapped[str] = mapped_column(SAEnum("diogo", "lis", name="person_type"))
    month: Mapped[int] = mapped_column()
    year: Mapped[int] = mapped_column()
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    transaction_count: Mapped[int] = mapped_column(default=0)
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="file")

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[str] = mapped_column(SAEnum("expense", "income", "transfer", "investment", name="tx_type"))
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    person: Mapped[str] = mapped_column(SAEnum("diogo", "lis", "joint", name="person_tx"))
    source: Mapped[str] = mapped_column(SAEnum("bank", "credit_card", "manual", name="tx_source"))
    file_id: Mapped[str | None] = mapped_column(ForeignKey("uploaded_files.id"), nullable=True)
    merchant_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manually_categorized: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    file: Mapped["UploadedFile | None"] = relationship(back_populates="transactions")
```

- [ ] **Step 3: Create backend/app/models/plan.py**

```python
import uuid
from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, ForeignKey, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class SavingsPlan(Base):
    __tablename__ = "savings_plans"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    goal_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    target_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    category_budgets: Mapped[list["PlanCategoryBudget"]] = relationship(back_populates="plan", cascade="all, delete-orphan")

class PlanCategoryBudget(Base):
    __tablename__ = "plan_category_budgets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id: Mapped[str] = mapped_column(ForeignKey("savings_plans.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    monthly_limit: Mapped[float] = mapped_column(Numeric(10, 2))
    plan: Mapped["SavingsPlan"] = relationship(back_populates="category_budgets")
```

- [ ] **Step 4: Create backend/app/models/__init__.py**

```python
from .category import Category, CategoryRule
from .transaction import Transaction, UploadedFile
from .plan import SavingsPlan, PlanCategoryBudget

__all__ = ["Category", "CategoryRule", "Transaction", "UploadedFile", "SavingsPlan", "PlanCategoryBudget"]
```

- [ ] **Step 5: Initialize Alembic**

```bash
cd backend
alembic init alembic
```

Edit `alembic.ini`: set `sqlalchemy.url = postgresql://financas:financas@localhost:5432/financas`

Edit `alembic/env.py` — replace target_metadata line:
```python
from app.database import Base
from app import models  # noqa — imports all models so Alembic sees them
target_metadata = Base.metadata
```

- [ ] **Step 6: Generate + run initial migration**

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected: all tables created in PostgreSQL.

- [ ] **Step 7: Write model import test**

In `tests/test_models.py`:
```python
from app.models import Category, Transaction, SavingsPlan

def test_models_importable():
    assert Category.__tablename__ == "categories"
    assert Transaction.__tablename__ == "transactions"
    assert SavingsPlan.__tablename__ == "savings_plans"
```

Run: `pytest tests/test_models.py -v` → PASS

- [ ] **Step 8: Commit**
```bash
git add backend/app/models/ backend/alembic* backend/alembic.ini
git commit -m "feat: database models + alembic initial migration"
```

---

### Task 3: Seed data (default categories + rules)

**Files:**
- Create: `backend/app/seed.py`

- [ ] **Step 1: Write test for seed**

In `tests/test_seed.py`:
```python
from app.seed import seed_categories
from app.models import Category, CategoryRule
from sqlalchemy.orm import Session

def test_seed_creates_categories(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    Session = sessionmaker(bind=engine)
    db = Session()
    seed_categories(db)
    cats = db.query(Category).all()
    names = [c.name for c in cats]
    assert "Alimentação" in names
    assert "Transporte" in names
    assert "Outros" in names
    rules = db.query(CategoryRule).all()
    assert len(rules) > 10
    db.close()
```

Run: `pytest tests/test_seed.py -v` → FAIL (seed.py doesn't exist)

- [ ] **Step 2: Create backend/app/seed.py**

```python
from sqlalchemy.orm import Session
from app.models import Category, CategoryRule

DEFAULT_CATEGORIES = [
    {"name": "Alimentação", "color": "#e9c46a", "icon": "🍔", "keywords": [
        "SUPERMERCAD", "PAO", "PADARIA", "RESTAUR", "ALIMENT", "LANCHE",
        "BOTECO", "BAR DO", "ESPETINHO", "MORI MORI", "FRIGOR",
    ]},
    {"name": "Transporte", "color": "#4caf82", "icon": "🚗", "keywords": [
        "UBER", "DL*UBER", "DL *UBER", "POSTO", "COMBUSTIV", "ESTACION",
    ]},
    {"name": "Moradia", "color": "#7c6af7", "icon": "🏠", "keywords": [
        "ALUGUEL", "CONDOMIN", "AGUA", "SANEAM",
    ]},
    {"name": "Saúde", "color": "#f08080", "icon": "🏥", "keywords": [
        "FARMACIA", "DROGARIA", "CLINICA", "MEDIC", "HOSPITAL",
    ]},
    {"name": "Educação", "color": "#87ceeb", "icon": "📚", "keywords": [
        "ESCOLA", "FACULDAD", "CURSO", "UDEMY", "LIVRO",
    ]},
    {"name": "Lazer", "color": "#dda0dd", "icon": "🎭", "keywords": [
        "CINEMA", "TEATRO", "SHOW", "SPOTIFY", "NETFLIX", "STEAM",
    ]},
    {"name": "Vestuário", "color": "#ffa07a", "icon": "👗", "keywords": [
        "VESTUARIO", "ROUPA", "CALCADO",
    ]},
    {"name": "Telecomunicações", "color": "#20b2aa", "icon": "📱", "keywords": [
        "TIM CELU", "VIVO", "CLARO", "OI TELEF",
    ]},
    {"name": "Energia", "color": "#ffd700", "icon": "⚡", "keywords": [
        "CEMIG DISTR", "INT /CEMIG", "CEMIG",
    ]},
    {"name": "Serviços & Seguros", "color": "#778899", "icon": "🔒", "keywords": [
        "SEGURO", "BRADESCO SEG", "PAY2ALL",
    ]},
    {"name": "Investimentos", "color": "#32cd32", "icon": "📈", "keywords": [
        "REND PAGO APLIC", "APLIC AUT",
    ]},
    {"name": "Renda", "color": "#00ced1", "icon": "💰", "keywords": [
        "REMUNERACAO", "SALARIO",
    ]},
    {"name": "Transferências", "color": "#b0c4de", "icon": "🔄", "keywords": [
        "PIX TRANSF",
    ]},
    {"name": "Outros", "color": "#808080", "icon": "❓", "keywords": []},
]

def seed_categories(db: Session) -> None:
    if db.query(Category).count() > 0:
        return
    priority = 100
    for cat_data in DEFAULT_CATEGORIES:
        cat = Category(name=cat_data["name"], color=cat_data["color"], icon=cat_data["icon"])
        db.add(cat)
        db.flush()
        for kw in cat_data["keywords"]:
            rule = CategoryRule(
                category_id=cat.id,
                keyword=kw.upper(),
                match_type="contains",
                priority=priority,
            )
            db.add(rule)
            priority -= 1
    db.commit()
```

- [ ] **Step 3: Wire seed into app startup**

In `backend/app/main.py`, add after imports:
```python
from app.database import SessionLocal
from app.seed import seed_categories

@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
```

- [ ] **Step 4: Run test**
```bash
pytest tests/test_seed.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: seed default categories and rules on startup"
```

---

## Phase 2: Auth

### Task 4: JWT authentication

**Files:**
- Create: `backend/app/auth.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/app/schemas/auth.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write auth tests**

In `tests/test_auth.py`:
```python
def test_login_correct_password(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    assert "token" in resp.json()

def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"password": "wrong"})
    assert resp.status_code == 401

def test_protected_endpoint_without_token(client):
    resp = client.get("/api/dashboard")
    assert resp.status_code == 401

def test_protected_endpoint_with_token(client):
    token = client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]
    resp = client.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
```

Run → FAIL (endpoints don't exist)

- [ ] **Step 2: Create backend/app/auth.py**

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

bearer = HTTPBearer()

def create_token() -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    return jwt.encode({"exp": expire}, settings.secret_key, algorithm=settings.jwt_algorithm)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> bool:
    try:
        jwt.decode(credentials.credentials, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return True
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
```

- [ ] **Step 3: Create backend/app/schemas/auth.py**

```python
from pydantic import BaseModel

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    token: str
```

- [ ] **Step 4: Create backend/app/routers/auth.py**

```python
from fastapi import APIRouter, HTTPException, status
from app.schemas.auth import LoginRequest, LoginResponse
from app.auth import create_token
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    if req.password != settings.app_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta")
    return LoginResponse(token=create_token())
```

- [ ] **Step 5: Add placeholder dashboard + wire routers in main.py**

```python
# In main.py
from app.routers import auth as auth_router
from app.auth import verify_token
from fastapi import Depends

app.include_router(auth_router.router)

@app.get("/api/dashboard", dependencies=[Depends(verify_token)])
def dashboard_placeholder():
    return {"message": "ok"}
```

- [ ] **Step 6: Run tests**
```bash
pytest tests/test_auth.py -v
```
Expected: all PASS

- [ ] **Step 7: Commit**
```bash
git commit -am "feat: JWT authentication — login endpoint + bearer token middleware"
```

---

## Phase 3: PDF Parsing

### Task 5: Credit card PDF parser (fatura)

**Files:**
- Create: `backend/app/services/pdf_parser.py`
- Create sample fixture: `tests/fixtures/` (copy one fatura PDF here for tests)

- [ ] **Step 1: Copy a fatura PDF as test fixture**

```bash
mkdir -p backend/tests/fixtures
cp "d:/Pessoal/Sistemas/finanças/Fatura_Itau_20260516-190827.pdf" backend/tests/fixtures/fatura_sample.pdf
```

- [ ] **Step 2: Write parser tests**

In `tests/test_pdf_parser.py`:
```python
import os
from app.services.pdf_parser import parse_credit_card_pdf, parse_statement_pdf

FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")

def test_parse_fatura_returns_transactions():
    txs = parse_credit_card_pdf(FATURA)
    assert len(txs) > 0

def test_fatura_transaction_fields():
    txs = parse_credit_card_pdf(FATURA)
    tx = txs[0]
    assert "date" in tx
    assert "description" in tx
    assert "amount" in tx
    assert tx["amount"] < 0  # expenses are negative
    assert "itau_category" in tx

def test_fatura_contains_uber():
    txs = parse_credit_card_pdf(FATURA)
    descs = [t["description"].upper() for t in txs]
    assert any("UBER" in d for d in descs)
```

Run → FAIL

- [ ] **Step 3: Create backend/app/services/pdf_parser.py (fatura section)**

```python
import re
from datetime import date
from typing import Any
import pdfplumber

# Matches: "02/04 SERROTINHO . 51,00" or "02/04 DL*UberRides 11,99"
TX_LINE = re.compile(r"^(\d{2}/\d{2})\s+(.+?)\s+([\d.,]+)$")
# Matches: "ALIMENTAÇÃO .BELO HORIZONT" or "VEÍCULOS .Sao Paulo"
CAT_LINE = re.compile(r"^([A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+)\s+\.\s*\S")

ITAU_CATEGORY_MAP = {
    "ALIMENTAÇÃO": "Alimentação",
    "VEÍCULOS": "Transporte",
    "VESTUÁRIO": "Vestuário",
    "DIVERSOS": "Outros",
    "SAÚDE": "Saúde",
    "EDUCAÇÃO": "Educação",
    "ENTRETENIMENTO": "Lazer",
    "COMUNICAÇÃO": "Telecomunicações",
    "CASA": "Moradia",
    "VIAGENS": "Lazer",
}

MERCHANT_NORMALIZATIONS = [
    (re.compile(r"DL\s*\*\s*UberRides", re.I), "Uber"),
    (re.compile(r"Uber\s+UBER\s+\*TRIP", re.I), "Uber"),
    (re.compile(r"UBER\*\s*TRIP", re.I), "Uber"),
    (re.compile(r"CPG\*(.+)", re.I), lambda m: m.group(1).strip()),
]

def _normalize_merchant(raw: str) -> str:
    for pattern, replacement in MERCHANT_NORMALIZATIONS:
        if pattern.search(raw):
            if callable(replacement):
                return pattern.sub(replacement, raw)
            return replacement
    return raw.strip()

def _parse_amount(raw: str) -> float:
    return -float(raw.replace(".", "").replace(",", "."))

def parse_credit_card_pdf(path: str) -> list[dict[str, Any]]:
    transactions = []
    with pdfplumber.open(path) as pdf:
        year = None
        # Detect year from header (Emissão or Vencimento line)
        for page in pdf.pages:
            text = page.extract_text() or ""
            m = re.search(r"Vencimento:\s*\d{2}/\d{2}/(\d{4})", text)
            if m:
                year = int(m.group(1))
                break
        if not year:
            from datetime import datetime
            year = datetime.now().year

        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.splitlines()
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                m = TX_LINE.match(line)
                if m:
                    day_month, desc, amount_raw = m.group(1), m.group(2), m.group(3)
                    day, month = map(int, day_month.split("/"))
                    tx_date = date(year, month, day)
                    itau_cat = None
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        cm = CAT_LINE.match(next_line)
                        if cm:
                            raw_cat = cm.group(1).strip().upper()
                            itau_cat = ITAU_CATEGORY_MAP.get(raw_cat)
                            if not itau_cat:
                                # try partial match
                                for k, v in ITAU_CATEGORY_MAP.items():
                                    if raw_cat.startswith(k):
                                        itau_cat = v
                                        break
                    transactions.append({
                        "date": tx_date,
                        "description": desc.strip(),
                        "merchant_name": _normalize_merchant(desc.strip()),
                        "amount": _parse_amount(amount_raw),
                        "itau_category": itau_cat,
                        "source": "credit_card",
                        "raw_text": line,
                    })
                i += 1
    return transactions
```

- [ ] **Step 4: Run tests**
```bash
pytest tests/test_pdf_parser.py::test_parse_fatura_returns_transactions -v
pytest tests/test_pdf_parser.py::test_fatura_transaction_fields -v
pytest tests/test_pdf_parser.py::test_fatura_contains_uber -v
```
Expected: PASS. Adjust regex if needed based on actual PDF output.

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: credit card PDF parser (fatura Itaú)"
```

---

### Task 6: Bank statement PDF parser (extrato)

**Files:**
- Modify: `backend/app/services/pdf_parser.py`
- Modify: `backend/tests/test_pdf_parser.py`

- [ ] **Step 1: Copy extrato as fixture**
```bash
cp "d:/Pessoal/Sistemas/finanças/itau_extrato_012026.pdf" backend/tests/fixtures/extrato_sample.pdf
```

- [ ] **Step 2: Add extrato tests**

```python
EXTRATO = os.path.join(os.path.dirname(__file__), "fixtures/extrato_sample.pdf")

def test_parse_extrato_returns_transactions():
    txs = parse_statement_pdf(EXTRATO)
    assert len(txs) > 0

def test_extrato_has_salary():
    txs = parse_statement_pdf(EXTRATO)
    incomes = [t for t in txs if "SALARIO" in t["description"].upper() or "REMUNERACAO" in t["description"].upper()]
    assert len(incomes) > 0

def test_extrato_salary_is_positive():
    txs = parse_statement_pdf(EXTRATO)
    salary = next(t for t in txs if "REMUNERACAO" in t["description"].upper())
    assert salary["amount"] > 0

def test_extrato_skips_saldo_lines():
    txs = parse_statement_pdf(EXTRATO)
    descs = [t["description"] for t in txs]
    assert not any("SALDO DO DIA" in d for d in descs)
```

Run → FAIL

- [ ] **Step 3: Add parse_statement_pdf to pdf_parser.py**

```python
# Pattern: "15/05/2026 ITAU MC 4528-8298 -6.864,26"
STMT_LINE = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+(.+?)\s+([-]?[\d.]+,\d{2})$")

def parse_statement_pdf(path: str) -> list[dict[str, Any]]:
    transactions = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                m = STMT_LINE.match(line)
                if not m:
                    continue
                date_str, desc, amount_raw = m.group(1), m.group(2), m.group(3)
                if "SALDO DO DIA" in desc.upper():
                    continue
                day, month, year = map(int, date_str.split("/"))
                tx_date = date(year, month, day)
                amount = float(amount_raw.replace(".", "").replace(",", "."))
                transactions.append({
                    "date": tx_date,
                    "description": desc.strip(),
                    "merchant_name": _normalize_merchant(desc.strip()),
                    "amount": amount,
                    "itau_category": None,
                    "source": "bank",
                    "raw_text": line,
                })
    return transactions
```

- [ ] **Step 4: Run tests**
```bash
pytest tests/test_pdf_parser.py -v
```
Expected: all PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: bank statement PDF parser (extrato Itaú)"
```

---

### Task 7: Auto-categorizer

**Files:**
- Create: `backend/app/services/categorizer.py`
- Create: `backend/tests/test_categorizer.py`

- [ ] **Step 1: Write categorizer tests**

```python
from app.services.categorizer import categorize_transaction
from app.models import Category, CategoryRule

def test_categorize_by_itau_category(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "DL*UberRides", "itau_category": "Transporte", "source": "credit_card"}
    result = categorize_transaction(tx, db)
    assert result is not None
    assert result.name == "Transporte"
    db.close()

def test_categorize_by_keyword(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "DA TIM CELU 52472140000", "itau_category": None, "source": "bank"}
    result = categorize_transaction(tx, db)
    assert result is not None
    assert result.name == "Telecomunicações"
    db.close()

def test_categorize_fallback_to_outros(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "XYZXYZ UNKNOWN", "itau_category": None, "source": "bank"}
    result = categorize_transaction(tx, db)
    assert result.name == "Outros"
    db.close()
```

Run → FAIL

- [ ] **Step 2: Create backend/app/services/categorizer.py**

```python
from sqlalchemy.orm import Session
from app.models import Category, CategoryRule

def categorize_transaction(tx: dict, db: Session) -> Category | None:
    # 1. Try Itaú category label
    if tx.get("itau_category"):
        cat = db.query(Category).filter(Category.name == tx["itau_category"]).first()
        if cat:
            return cat

    # 2. Keyword matching — highest priority first
    desc = tx.get("description", "").upper()
    rules = (
        db.query(CategoryRule)
        .join(Category)
        .order_by(CategoryRule.priority.desc())
        .all()
    )
    for rule in rules:
        kw = rule.keyword.upper()
        matched = False
        if rule.match_type == "contains" and kw in desc:
            matched = True
        elif rule.match_type == "starts_with" and desc.startswith(kw):
            matched = True
        elif rule.match_type == "exact" and desc == kw:
            matched = True
        if matched:
            return rule.category

    # 3. Fallback to Outros
    return db.query(Category).filter(Category.name == "Outros").first()
```

- [ ] **Step 3: Run tests**
```bash
pytest tests/test_categorizer.py -v
```
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git commit -am "feat: auto-categorizer with Itaú label + keyword matching"
```

---

## Phase 4: API Endpoints

### Task 8: Upload endpoints

**Files:**
- Create: `backend/app/schemas/transaction.py`
- Create: `backend/app/routers/upload.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create backend/app/schemas/transaction.py**

```python
from pydantic import BaseModel
from datetime import date
from typing import Optional

class TransactionPreview(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str]
    amount: float
    category_name: Optional[str]
    source: str
    raw_text: Optional[str]

class TransactionIn(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str]
    amount: float
    category_id: Optional[str]
    source: str
    raw_text: Optional[str]

class UploadPreviewResponse(BaseModel):
    file_id_temp: str
    transactions: list[TransactionPreview]

class UploadConfirmRequest(BaseModel):
    file_id_temp: str
    person: str  # diogo | lis
    filename: str
    file_type: str  # statement | credit_card
    transactions: list[TransactionIn]
```

- [ ] **Step 2: Write upload tests**

In `tests/test_upload.py`:
```python
import os

FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")

def get_token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]

def auth(client):
    return {"Authorization": f"Bearer {get_token(client)}"}

def test_upload_fatura_returns_preview(client):
    with open(FATURA, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": ("fatura.pdf", f, "application/pdf")},
            data={"person": "diogo"},
            headers=auth(client),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "transactions" in data
    assert len(data["transactions"]) > 0
    assert "file_id_temp" in data

def test_upload_confirm_saves_transactions(client):
    # First upload
    with open(FATURA, "rb") as f:
        preview = client.post(
            "/api/upload",
            files={"file": ("fatura.pdf", f, "application/pdf")},
            data={"person": "diogo"},
            headers=auth(client),
        ).json()
    # Then confirm
    resp = client.post("/api/upload/confirm", json={
        "file_id_temp": preview["file_id_temp"],
        "person": "diogo",
        "filename": "fatura.pdf",
        "file_type": "credit_card",
        "transactions": preview["transactions"],
    }, headers=auth(client))
    assert resp.status_code == 200
    assert resp.json()["saved"] > 0
```

Run → FAIL

- [ ] **Step 3: Create backend/app/routers/upload.py**

```python
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_token
from app.services.pdf_parser import parse_credit_card_pdf, parse_statement_pdf
from app.services.categorizer import categorize_transaction
from app.schemas.transaction import UploadPreviewResponse, TransactionPreview, UploadConfirmRequest
from app.models import Transaction, UploadedFile
from app.seed import seed_categories
import tempfile, os

router = APIRouter(prefix="/api/upload", tags=["upload"], dependencies=[Depends(verify_token)])

_temp_store: dict[str, dict] = {}  # in-memory temp for preview; acceptable for single-user app

def _detect_type(filename: str) -> str:
    name = filename.lower()
    if "fatura" in name:
        return "credit_card"
    return "statement"

@router.post("", response_model=UploadPreviewResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    person: str = Form(...),
    db: Session = Depends(get_db),
):
    seed_categories(db)
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        file_type = _detect_type(file.filename or "")
        if file_type == "credit_card":
            raw_txs = parse_credit_card_pdf(tmp_path)
        else:
            raw_txs = parse_statement_pdf(tmp_path)
    finally:
        os.unlink(tmp_path)

    previews = []
    for tx in raw_txs:
        cat = categorize_transaction(tx, db)
        previews.append(TransactionPreview(
            date=tx["date"],
            description=tx["description"],
            merchant_name=tx.get("merchant_name"),
            amount=tx["amount"],
            category_name=cat.name if cat else None,
            source=tx["source"],
            raw_text=tx.get("raw_text"),
        ))

    temp_id = str(uuid.uuid4())
    _temp_store[temp_id] = {"previews": previews, "file_type": file_type, "filename": file.filename}
    return UploadPreviewResponse(file_id_temp=temp_id, transactions=previews)

@router.post("/confirm")
def confirm_upload(req: UploadConfirmRequest, db: Session = Depends(get_db)):
    seed_categories(db)
    from datetime import datetime
    dates = [t.date for t in req.transactions]
    month = dates[0].month if dates else datetime.now().month
    year = dates[0].year if dates else datetime.now().year

    uploaded = UploadedFile(
        filename=req.filename,
        file_type=req.file_type,
        person=req.person,
        month=month,
        year=year,
        transaction_count=len(req.transactions),
    )
    db.add(uploaded)
    db.flush()

    from app.models import Category
    cat_cache: dict[str, str] = {}

    def get_cat_id(name: str | None) -> str | None:
        if not name:
            return None
        if name not in cat_cache:
            cat = db.query(Category).filter(Category.name == name).first()
            cat_cache[name] = cat.id if cat else None
        return cat_cache[name]

    for tx in req.transactions:
        t = Transaction(
            date=tx.date,
            description=tx.description,
            merchant_name=tx.merchant_name,
            amount=tx.amount,
            type="expense" if tx.amount < 0 else "income",
            category_id=get_cat_id(None) if not tx.category_id else tx.category_id,
            person=req.person,
            source=tx.source,
            file_id=uploaded.id,
            raw_text=tx.raw_text,
        )
        db.add(t)

    db.commit()
    return {"saved": len(req.transactions), "file_id": uploaded.id}
```

- [ ] **Step 4: Register router in main.py**

```python
from app.routers import upload as upload_router
app.include_router(upload_router.router)
```

- [ ] **Step 5: Run tests**
```bash
pytest tests/test_upload.py -v
```
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git commit -am "feat: upload PDF endpoints (preview + confirm)"
```

---

### Task 9: Dashboard endpoint

**Files:**
- Create: `backend/app/schemas/dashboard.py`
- Create: `backend/app/routers/dashboard.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create schemas/dashboard.py**

```python
from pydantic import BaseModel
from typing import Optional

class CategoryTotal(BaseModel):
    category_id: str
    category_name: str
    color: str
    total: float
    percentage: float

class MonthlyTotal(BaseModel):
    year: int
    month: int
    total_expense: float
    total_income: float

class DashboardResponse(BaseModel):
    month: int
    year: int
    total_expense: float
    total_income: float
    balance: float
    vs_last_month_pct: Optional[float]
    by_category: list[CategoryTotal]
    monthly_history: list[MonthlyTotal]
    recent_transactions: list[dict]
```

- [ ] **Step 2: Write dashboard tests**

In `tests/test_dashboard.py`:
```python
from datetime import date

def seed_tx(db, amount, category_id, month=5, year=2026, person="diogo"):
    from app.models import Transaction
    tx = Transaction(
        date=date(year, month, 15),
        description="Test",
        amount=amount,
        type="expense" if amount < 0 else "income",
        category_id=category_id,
        person=person,
        source="manual",
    )
    db.add(tx)
    db.commit()

def get_token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]

def test_dashboard_returns_totals(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    from app.models import Category
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    cat = db.query(Category).filter(Category.name == "Alimentação").first()
    seed_tx(db, -100.0, cat.id)
    seed_tx(db, -200.0, cat.id)
    seed_tx(db, 4000.0, cat.id)  # income
    db.close()

    token = get_token(client)
    resp = client.get("/api/dashboard?month=5&year=2026", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_expense"] == 300.0
    assert data["total_income"] == 4000.0
```

Run → FAIL

- [ ] **Step 3: Create backend/app/routers/dashboard.py**

```python
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, Category
from app.schemas.dashboard import DashboardResponse, CategoryTotal, MonthlyTotal

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(verify_token)])

@router.get("", response_model=DashboardResponse)
def get_dashboard(
    month: int = Query(default=None),
    year: int = Query(default=None),
    person: str = Query(default=None),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    month = month or now.month
    year = year or now.year

    q = db.query(Transaction).filter(
        func.extract("month", Transaction.date) == month,
        func.extract("year", Transaction.date) == year,
    )
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)

    txs = q.all()
    total_expense = abs(sum(t.amount for t in txs if t.amount < 0))
    total_income = sum(t.amount for t in txs if t.amount > 0)

    # Last month comparison
    if month == 1:
        prev_month, prev_year = 12, year - 1
    else:
        prev_month, prev_year = month - 1, year
    prev_q = db.query(Transaction).filter(
        func.extract("month", Transaction.date) == prev_month,
        func.extract("year", Transaction.date) == prev_year,
    )
    if person and person != "ambos":
        prev_q = prev_q.filter(Transaction.person == person)
    prev_expense = abs(sum(t.amount for t in prev_q.all() if t.amount < 0))
    vs_last = ((total_expense - prev_expense) / prev_expense * 100) if prev_expense else None

    # By category
    cat_totals: dict[str, float] = {}
    for tx in txs:
        if tx.amount < 0 and tx.category_id:
            cat_totals[tx.category_id] = cat_totals.get(tx.category_id, 0) + abs(tx.amount)
    by_category = []
    for cat_id, total in sorted(cat_totals.items(), key=lambda x: x[1], reverse=True):
        cat = db.query(Category).filter(Category.id == cat_id).first()
        if cat:
            by_category.append(CategoryTotal(
                category_id=cat_id,
                category_name=cat.name,
                color=cat.color,
                total=round(total, 2),
                percentage=round(total / total_expense * 100, 1) if total_expense else 0,
            ))

    # Monthly history (last 6 months)
    history = []
    for i in range(5, -1, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        ht = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
        ).all()
        history.append(MonthlyTotal(
            year=y, month=m,
            total_expense=round(abs(sum(t.amount for t in ht if t.amount < 0)), 2),
            total_income=round(sum(t.amount for t in ht if t.amount > 0), 2),
        ))

    recent = [{
        "id": t.id, "date": str(t.date), "description": t.description,
        "amount": float(t.amount), "person": t.person,
    } for t in sorted(txs, key=lambda x: x.date, reverse=True)[:10]]

    return DashboardResponse(
        month=month, year=year,
        total_expense=round(total_expense, 2),
        total_income=round(total_income, 2),
        balance=round(total_income - total_expense, 2),
        vs_last_month_pct=round(vs_last, 1) if vs_last is not None else None,
        by_category=by_category,
        monthly_history=history,
        recent_transactions=recent,
    )
```

- [ ] **Step 4: Register + test**
```python
# main.py
from app.routers import dashboard as dashboard_router
app.include_router(dashboard_router.router)
```
```bash
pytest tests/test_dashboard.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: dashboard API endpoint"
```

---

### Task 10: Transactions, Categories, Trends, Plans endpoints

**Files:**
- Create: `backend/app/routers/transactions.py`
- Create: `backend/app/routers/categories.py`
- Create: `backend/app/routers/trends.py`
- Create: `backend/app/routers/plans.py`

- [ ] **Step 1: Create backend/app/routers/transactions.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, Category
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(verify_token)])

class TransactionUpdate(BaseModel):
    category_id: Optional[str] = None
    person: Optional[str] = None

class TransactionCreate(BaseModel):
    date: date
    description: str
    amount: float
    category_id: Optional[str] = None
    person: str
    source: str = "manual"

@router.get("")
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    person: Optional[str] = None,
    category_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if month:
        q = q.filter(func.extract("month", Transaction.date) == month)
    if year:
        q = q.filter(func.extract("year", Transaction.date) == year)
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    total = q.count()
    txs = q.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_tx_dict(t, db) for t in txs]}

def _tx_dict(t: Transaction, db: Session) -> dict:
    cat = db.query(Category).filter(Category.id == t.category_id).first() if t.category_id else None
    return {
        "id": t.id, "date": str(t.date), "description": t.description,
        "merchant_name": t.merchant_name, "amount": float(t.amount),
        "type": t.type, "person": t.person, "source": t.source,
        "category_id": t.category_id,
        "category_name": cat.name if cat else None,
        "category_color": cat.color if cat else None,
        "manually_categorized": t.manually_categorized,
    }

@router.post("")
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    tx = Transaction(**body.model_dump(), type="expense" if body.amount < 0 else "income")
    db.add(tx); db.commit(); db.refresh(tx)
    return _tx_dict(tx, db)

@router.patch("/{tx_id}")
def update_transaction(tx_id: str, body: TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(404)
    if body.category_id is not None:
        tx.category_id = body.category_id
        tx.manually_categorized = True
    if body.person is not None:
        tx.person = body.person
    db.commit()
    return _tx_dict(tx, db)
```

- [ ] **Step 2: Create backend/app/routers/categories.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Category, CategoryRule, Transaction
from pydantic import BaseModel

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(verify_token)])

class CategoryCreate(BaseModel):
    name: str
    color: str = "#808080"
    icon: str = "❓"
    monthly_budget: Optional[float] = None

class RuleCreate(BaseModel):
    keyword: str
    match_type: str = "contains"
    priority: int = 0

@router.get("")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    return [{"id": c.id, "name": c.name, "color": c.color, "icon": c.icon,
             "monthly_budget": c.monthly_budget,
             "rule_count": len(c.rules)} for c in cats]

@router.post("")
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(**body.model_dump())
    db.add(cat); db.commit(); db.refresh(cat)
    return cat

@router.put("/{cat_id}")
def update_category(cat_id: str, body: CategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404)
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    db.commit()
    return cat

@router.delete("/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404)
    outros = db.query(Category).filter(Category.name == "Outros").first()
    db.query(Transaction).filter(Transaction.category_id == cat_id).update({"category_id": outros.id if outros else None})
    db.delete(cat); db.commit()
    return {"ok": True}

@router.get("/{cat_id}/rules")
def get_rules(cat_id: str, db: Session = Depends(get_db)):
    return db.query(CategoryRule).filter(CategoryRule.category_id == cat_id).all()

@router.post("/{cat_id}/rules")
def add_rule(cat_id: str, body: RuleCreate, db: Session = Depends(get_db)):
    rule = CategoryRule(category_id=cat_id, **body.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return rule

@router.delete("/{cat_id}/rules/{rule_id}")
def delete_rule(cat_id: str, rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(CategoryRule).filter(CategoryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404)
    db.delete(rule); db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Create backend/app/routers/trends.py**

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, Category
from datetime import datetime

router = APIRouter(prefix="/api/trends", tags=["trends"], dependencies=[Depends(verify_token)])

@router.get("")
def trends_by_category(
    category_id: Optional[str] = Query(None),
    person: Optional[str] = Query(None),
    months: int = Query(12),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    results = []
    for i in range(months - 1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12; y -= 1
        q = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
            Transaction.amount < 0,
        )
        if category_id:
            q = q.filter(Transaction.category_id == category_id)
        if person and person != "ambos":
            q = q.filter(Transaction.person == person)
        total = abs(sum(t.amount for t in q.all()))
        results.append({"year": y, "month": m, "total": round(total, 2)})
    return results

@router.get("/merchant")
def trends_by_merchant(
    q: str = Query(...),
    person: Optional[str] = Query(None),
    months: int = Query(12),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    monthly = []
    all_txs = []
    for i in range(months - 1, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12; y -= 1
        query = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
            Transaction.amount < 0,
            func.upper(Transaction.merchant_name).contains(q.upper()),
        )
        if person and person != "ambos":
            query = query.filter(Transaction.person == person)
        txs = query.all()
        total = abs(sum(t.amount for t in txs))
        monthly.append({"year": y, "month": m, "total": round(total, 2), "count": len(txs)})
        all_txs.extend(txs)

    first_nonzero = next((m["total"] for m in monthly if m["total"] > 0), 0)
    last_total = monthly[-1]["total"] if monthly else 0
    growth_pct = ((last_total - first_nonzero) / first_nonzero * 100) if first_nonzero else None

    recent = sorted(all_txs, key=lambda t: t.date, reverse=True)[:20]
    return {
        "merchant": q,
        "monthly": monthly,
        "growth_pct": round(growth_pct, 1) if growth_pct is not None else None,
        "recent_transactions": [
            {"id": t.id, "date": str(t.date), "description": t.description,
             "amount": float(t.amount), "person": t.person}
            for t in recent
        ],
    }
```

- [ ] **Step 4: Create backend/app/routers/plans.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime
from app.database import get_db
from app.auth import verify_token
from app.models import SavingsPlan, PlanCategoryBudget, Transaction, Category
from pydantic import BaseModel

router = APIRouter(prefix="/api/plans", tags=["plans"], dependencies=[Depends(verify_token)])

class BudgetItem(BaseModel):
    category_id: str
    monthly_limit: float

class PlanCreate(BaseModel):
    name: str
    goal_amount: float
    target_date: date
    category_budgets: list[BudgetItem] = []

@router.get("")
def list_plans(db: Session = Depends(get_db)):
    return db.query(SavingsPlan).filter(SavingsPlan.is_active == True).all()

@router.post("")
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    plan = SavingsPlan(name=body.name, goal_amount=body.goal_amount, target_date=body.target_date)
    db.add(plan); db.flush()
    for b in body.category_budgets:
        db.add(PlanCategoryBudget(plan_id=plan.id, **b.model_dump()))
    db.commit(); db.refresh(plan)
    return plan

@router.put("/{plan_id}")
def update_plan(plan_id: str, body: PlanCreate, db: Session = Depends(get_db)):
    plan = db.query(SavingsPlan).filter(SavingsPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404)
    plan.name = body.name; plan.goal_amount = body.goal_amount; plan.target_date = body.target_date
    db.query(PlanCategoryBudget).filter(PlanCategoryBudget.plan_id == plan_id).delete()
    for b in body.category_budgets:
        db.add(PlanCategoryBudget(plan_id=plan.id, **b.model_dump()))
    db.commit()
    return plan

@router.get("/{plan_id}/status")
def plan_status(plan_id: str, db: Session = Depends(get_db)):
    plan = db.query(SavingsPlan).filter(SavingsPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404)
    now = datetime.now()
    category_status = []
    for budget in plan.category_budgets:
        spent = abs(sum(
            t.amount for t in db.query(Transaction).filter(
                Transaction.category_id == budget.category_id,
                Transaction.amount < 0,
                func.extract("month", Transaction.date) == now.month,
                func.extract("year", Transaction.date) == now.year,
            ).all()
        ))
        cat = db.query(Category).filter(Category.id == budget.category_id).first()
        category_status.append({
            "category_id": budget.category_id,
            "category_name": cat.name if cat else None,
            "color": cat.color if cat else None,
            "monthly_limit": float(budget.monthly_limit),
            "spent_this_month": round(spent, 2),
            "percentage": round(spent / budget.monthly_limit * 100, 1) if budget.monthly_limit else 0,
            "over_budget": spent > budget.monthly_limit,
        })
    # Projection: months remaining, savings per month needed
    months_remaining = max(1, (plan.target_date.year - now.year) * 12 + (plan.target_date.month - now.month))
    total_monthly_limit = sum(b.monthly_limit for b in plan.category_budgets)
    return {
        "plan_id": plan_id,
        "name": plan.name,
        "goal_amount": float(plan.goal_amount),
        "target_date": str(plan.target_date),
        "months_remaining": months_remaining,
        "category_budgets": category_status,
    }
```

- [ ] **Step 5: Register all routers in main.py**

```python
from app.routers import transactions as tx_router, categories as cat_router
from app.routers import trends as trends_router, plans as plans_router

app.include_router(tx_router.router)
app.include_router(cat_router.router)
app.include_router(trends_router.router)
app.include_router(plans_router.router)
```

- [ ] **Step 6: Smoke test all endpoints**
```bash
uvicorn app.main:app --reload
# Login
TOKEN=$(curl -s -X POST localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"password":"changeme"}' | python -c "import sys,json; print(json.load(sys.stdin)['token'])")
# Test endpoints
curl -s localhost:8000/api/categories -H "Authorization: Bearer $TOKEN" | python -m json.tool
curl -s localhost:8000/api/transactions -H "Authorization: Bearer $TOKEN" | python -m json.tool
curl -s localhost:8000/api/plans -H "Authorization: Bearer $TOKEN" | python -m json.tool
```
Expected: each returns valid JSON with no 500 errors.

- [ ] **Step 7: Commit**
```bash
git commit -am "feat: transactions, categories, trends, plans API endpoints"
```

---

## Milestone ✅ Backend Complete

At this point, the backend API is fully functional. Test by importing one of the PDFs via curl and checking the dashboard endpoint.

---

## Phase 5: Frontend

### Task 11: React app scaffold

**Files:**
- Create: `frontend/` via Vite

- [ ] **Step 1: Scaffold with Vite**
```bash
cd d:/Pessoal/Sistemas/finanças
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install recharts axios react-router-dom zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

In `frontend/tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

In `frontend/src/index.css`, replace with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { background: #0f0f1a; color: #e0e0e0; }
```

- [ ] **Step 3: Create frontend/src/types/index.ts**

```typescript
export interface Category {
  id: string; name: string; color: string; icon: string;
  monthly_budget: number | null; rule_count: number;
}
export interface Transaction {
  id: string; date: string; description: string; merchant_name: string | null;
  amount: number; type: string; person: string; source: string;
  category_id: string | null; category_name: string | null;
  category_color: string | null; manually_categorized: boolean;
}
export interface SavingsPlan {
  id: string; name: string; goal_amount: number;
  target_date: string; is_active: boolean;
}
export interface MonthlyTotal {
  year: number; month: number; total_expense: number; total_income: number;
}
export interface DashboardData {
  month: number; year: number; total_expense: number;
  total_income: number; balance: number; vs_last_month_pct: number | null;
  by_category: Array<{
    category_id: string; category_name: string; color: string;
    total: number; percentage: number;
  }>;
  monthly_history: MonthlyTotal[];
  recent_transactions: Transaction[];
}
```

- [ ] **Step 4: Create frontend/src/api/client.ts**

```typescript
import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
```

- [ ] **Step 5: Create frontend/src/store/person.ts**

```typescript
import { create } from "zustand";

type Person = "diogo" | "lis" | "ambos";

interface PersonStore {
  person: Person;
  setPerson: (p: Person) => void;
}

export const usePersonStore = create<PersonStore>((set) => ({
  person: "ambos",
  setPerson: (person) => set({ person }),
}));
```

- [ ] **Step 6: Create frontend/src/App.tsx**

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Import from "./pages/Import";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Plans from "./pages/Plans";
import Trends from "./pages/Trends";
import Layout from "./components/Layout/Sidebar";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import" element={<Import />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="categories" element={<Categories />} />
          <Route path="plans" element={<Plans />} />
          <Route path="trends" element={<Trends />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Verify build compiles**
```bash
cd frontend && npm run build
```
Expected: build succeeds (pages are stubs at this point — create empty placeholder components as needed).

- [ ] **Step 8: Commit**
```bash
git add frontend/
git commit -m "feat: React frontend scaffold with routing, API client, person store"
```

---

### Task 12: Login page + Layout (Sidebar)

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/components/Layout/Sidebar.tsx`
- Create: `frontend/src/components/Layout/PersonFilter.tsx`

- [ ] **Step 1: Create frontend/src/pages/Login.tsx**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { password });
      localStorage.setItem("token", data.token);
      nav("/dashboard");
    } catch {
      setError("Senha incorreta");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
      <form onSubmit={handleSubmit} className="bg-[#1a1a2e] p-8 rounded-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-[#7c6af7]">💰 Finanças</h1>
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#0f0f1a] border border-[#333] rounded-lg px-4 py-2 text-white"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="w-full bg-[#7c6af7] text-white rounded-lg py-2 font-semibold">
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Create frontend/src/components/Layout/PersonFilter.tsx**

```tsx
import { usePersonStore } from "../../store/person";

export default function PersonFilter() {
  const { person, setPerson } = usePersonStore();
  const options = [
    { value: "ambos", label: "Ambos" },
    { value: "diogo", label: "Diogo" },
    { value: "lis", label: "Lis" },
  ] as const;
  return (
    <div className="flex gap-1 px-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setPerson(o.value)}
          className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
            person === o.value
              ? "bg-[#7c6af7] text-white"
              : "bg-[#252540] text-gray-400 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create frontend/src/components/Layout/Sidebar.tsx**

```tsx
import { Outlet, NavLink } from "react-router-dom";
import PersonFilter from "./PersonFilter";

const navItems = [
  { to: "/dashboard", icon: "📊", label: "Dashboard" },
  { to: "/import", icon: "📥", label: "Importar" },
  { to: "/transactions", icon: "💳", label: "Transações" },
  { to: "/categories", icon: "🏷️", label: "Categorias" },
  { to: "/plans", icon: "🎯", label: "Planos" },
  { to: "/trends", icon: "📈", label: "Tendências" },
];

export default function Sidebar() {
  return (
    <div className="flex h-screen bg-[#0f0f1a]">
      <aside className="w-52 bg-[#1a1a2e] flex flex-col py-4 gap-2 shrink-0">
        <div className="px-4 pb-2 text-[#7c6af7] font-bold text-lg">💰 Finanças</div>
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-[#7c6af7] text-white" : "text-gray-400 hover:text-white hover:bg-[#252540]"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#333] pt-3">
          <p className="px-4 text-xs text-gray-500 mb-2">Visualizar</p>
          <PersonFilter />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Build + check**
```bash
cd frontend && npm run build
```
Expected: no TypeScript errors.

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: Login page + Sidebar layout with PersonFilter"
```

---

### Task 13: Dashboard page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/components/Dashboard/SummaryCards.tsx`
- Create: `frontend/src/components/Dashboard/CategoryPieChart.tsx`
- Create: `frontend/src/components/Dashboard/MonthlyBarChart.tsx`

- [ ] **Step 1: Create SummaryCards.tsx**

```tsx
interface Props {
  totalExpense: number; totalIncome: number;
  balance: number; vsLastMonth: number | null;
}

export default function SummaryCards({ totalExpense, totalIncome, balance, vsLastMonth }: Props) {
  const fmt = (n: number) => `R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[
        { label: "Gastos", value: fmt(totalExpense), color: "text-red-400" },
        { label: "Renda", value: fmt(totalIncome), color: "text-green-400" },
        { label: "Saldo", value: (balance >= 0 ? "" : "-") + fmt(balance), color: balance >= 0 ? "text-green-400" : "text-red-400" },
        { label: "vs. mês ant.", value: vsLastMonth != null ? `${vsLastMonth > 0 ? "+" : ""}${vsLastMonth}%` : "—", color: vsLastMonth != null && vsLastMonth > 0 ? "text-red-400" : "text-green-400" },
      ].map((card) => (
        <div key={card.label} className="bg-[#1a1a2e] rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">{card.label}</p>
          <p className={`font-bold text-lg ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create CategoryPieChart.tsx**

```tsx
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  data: Array<{ category_name: string; total: number; color: string; percentage: number }>;
}

export default function CategoryPieChart({ data }: Props) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <h3 className="text-sm text-gray-400 mb-3">Por categoria</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="category_name" cx="50%" cy="50%" outerRadius={80}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
          <Legend formatter={(name) => <span className="text-xs text-gray-300">{name}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create MonthlyBarChart.tsx**

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MonthlyTotal } from "../../types";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function MonthlyBarChart({ data }: { data: MonthlyTotal[] }) {
  const chartData = data.map((d) => ({
    name: MONTHS[d.month - 1],
    Gastos: d.total_expense,
    Renda: d.total_income,
  }));
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <h3 className="text-sm text-gray-400 mb-3">Histórico mensal</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} />
          <YAxis tick={{ fill: "#888", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }}
            formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          />
          <Bar dataKey="Gastos" fill="#e05c5c" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Renda" fill="#4caf82" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create Dashboard.tsx**

```tsx
import { useEffect, useState } from "react";
import { DashboardData } from "../types";
import api from "../api/client";
import { usePersonStore } from "../store/person";
import SummaryCards from "../components/Dashboard/SummaryCards";
import CategoryPieChart from "../components/Dashboard/CategoryPieChart";
import MonthlyBarChart from "../components/Dashboard/MonthlyBarChart";

export default function Dashboard() {
  const { person } = usePersonStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  useEffect(() => {
    api.get<DashboardData>(`/dashboard?month=${month}&year=${year}&person=${person}`)
      .then((r) => setData(r.data));
  }, [person, month, year]);

  if (!data) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Dashboard — {month}/{year}</h1>
      <SummaryCards
        totalExpense={data.total_expense}
        totalIncome={data.total_income}
        balance={data.balance}
        vsLastMonth={data.vs_last_month_pct}
      />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <CategoryPieChart data={data.by_category} />
        <MonthlyBarChart data={data.monthly_history} />
      </div>
      <div className="bg-[#1a1a2e] rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">Últimas transações</h3>
        <div className="space-y-2">
          {data.recent_transactions.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span className="text-gray-300">{t.date} · {t.description}</span>
              <span className={t.amount < 0 ? "text-red-400" : "text-green-400"}>
                R$ {Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build + check**
```bash
cd frontend && npm run build
```

- [ ] **Step 6: Commit**
```bash
git commit -am "feat: Dashboard page with summary cards, pie chart, monthly bar chart"
```

---

### Task 14: Import page

**Files:**
- Create: `frontend/src/pages/Import.tsx`
- Create: `frontend/src/components/Import/DropZone.tsx`
- Create: `frontend/src/components/Import/PreviewTable.tsx`

- [ ] **Step 1: Create DropZone.tsx**

```tsx
import { useRef } from "react";

interface Props {
  onFile: (file: File) => void;
}

export default function DropZone({ onFile }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }
  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => ref.current?.click()}
      className="border-2 border-dashed border-[#7c6af7] rounded-xl p-10 text-center cursor-pointer hover:bg-[#1a1a2e] transition-colors"
    >
      <p className="text-4xl mb-2">📄</p>
      <p className="text-gray-300">Arraste um PDF aqui ou clique para selecionar</p>
      <p className="text-gray-500 text-sm mt-1">Extrato conta corrente ou fatura do cartão Itaú</p>
      <input ref={ref} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}
```

- [ ] **Step 2: Create PreviewTable.tsx**

```tsx
import { useState } from "react";

interface TxPreview {
  date: string; description: string; merchant_name: string | null;
  amount: number; category_name: string | null; source: string;
}

interface Props {
  transactions: TxPreview[];
  categories: Array<{ id: string; name: string }>;
  onChange: (idx: number, category_name: string) => void;
}

export default function PreviewTable({ transactions, categories, onChange }: Props) {
  return (
    <div className="overflow-auto max-h-96">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 text-left border-b border-[#333]">
            <th className="py-2 pr-4">Data</th>
            <th className="py-2 pr-4">Descrição</th>
            <th className="py-2 pr-4">Valor</th>
            <th className="py-2">Categoria</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, i) => (
            <tr key={i} className="border-b border-[#222] hover:bg-[#1a1a2e]">
              <td className="py-2 pr-4 text-gray-400">{tx.date}</td>
              <td className="py-2 pr-4">{tx.merchant_name || tx.description}</td>
              <td className={`py-2 pr-4 ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                R$ {Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2">
                <select
                  value={tx.category_name || ""}
                  onChange={(e) => onChange(i, e.target.value)}
                  className="bg-[#0f0f1a] border border-[#333] rounded px-2 py-1 text-sm text-gray-200"
                >
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create Import.tsx**

```tsx
import { useEffect, useState } from "react";
import api from "../api/client";
import DropZone from "../components/Import/DropZone";
import PreviewTable from "../components/Import/PreviewTable";
import { Category } from "../types";

interface TxPreview {
  date: string; description: string; merchant_name: string | null;
  amount: number; category_name: string | null; source: string; raw_text: string | null;
}

export default function Import() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [person, setPerson] = useState<"diogo" | "lis">("diogo");
  const [preview, setPreview] = useState<TxPreview[]>([]);
  const [fileIdTemp, setFileIdTemp] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [fileType, setFileType] = useState("credit_card");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);

  async function handleFile(file: File) {
    setLoading(true); setSaved(null);
    const form = new FormData();
    form.append("file", file);
    form.append("person", person);
    const { data } = await api.post("/upload", form);
    setPreview(data.transactions);
    setFileIdTemp(data.file_id_temp);
    setFilename(file.name);
    setFileType(file.name.toLowerCase().includes("fatura") ? "credit_card" : "statement");
    setLoading(false);
  }

  function updateCategory(idx: number, catName: string) {
    setPreview((prev) => prev.map((tx, i) => i === idx ? { ...tx, category_name: catName } : tx));
  }

  async function handleConfirm() {
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
    const txs = preview.map((tx) => ({
      ...tx, category_id: tx.category_name ? catMap[tx.category_name] : null,
    }));
    const { data } = await api.post("/upload/confirm", {
      file_id_temp: fileIdTemp, person, filename, file_type: fileType, transactions: txs,
    });
    setSaved(data.saved);
    setPreview([]);
    setFileIdTemp(null);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Importar PDF</h1>
      <div className="flex gap-4 items-center">
        <span className="text-gray-400 text-sm">Pessoa:</span>
        {(["diogo", "lis"] as const).map((p) => (
          <button key={p} onClick={() => setPerson(p)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${person === p ? "bg-[#7c6af7] text-white" : "bg-[#1a1a2e] text-gray-400"}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      {!preview.length && <DropZone onFile={handleFile} />}
      {loading && <p className="text-gray-400">Processando PDF...</p>}
      {saved != null && <p className="text-green-400">✅ {saved} transações salvas!</p>}
      {preview.length > 0 && (
        <div className="bg-[#1a1a2e] rounded-xl p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{preview.length} transações encontradas</h3>
            <button onClick={handleConfirm} className="bg-[#7c6af7] text-white px-6 py-2 rounded-lg font-semibold">
              Confirmar importação
            </button>
          </div>
          <PreviewTable transactions={preview} categories={categories} onChange={updateCategory} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build**
```bash
cd frontend && npm run build
```

- [ ] **Step 5: Commit**
```bash
git commit -am "feat: Import page with drag-drop, preview table, category editing"
```

---

### Task 15: Transactions, Categories, Plans, Trends pages

**Files:**
- Create: `frontend/src/pages/Transactions.tsx`
- Create: `frontend/src/pages/Categories.tsx`
- Create: `frontend/src/pages/Plans.tsx`
- Create: `frontend/src/pages/Trends.tsx`

- [ ] **Step 1: Create Transactions.tsx**

```tsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { Transaction, Category } from "../types";
import { usePersonStore } from "../store/person";

export default function Transactions() {
  const { person } = usePersonStore();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    api.get(`/transactions?month=${month}&year=${year}&person=${person}&limit=100`)
      .then((r) => setTxs(r.data.items));
  }, [person, month, year]);

  async function updateCategory(id: string, category_id: string) {
    await api.patch(`/transactions/${id}`, { category_id });
    setTxs((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const cat = categories.find((c) => c.id === category_id);
      return { ...t, category_id, category_name: cat?.name || null, category_color: cat?.color || null };
    }));
  }

  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold">Transações</h1>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-[#1a1a2e] border border-[#333] rounded px-3 py-1.5 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-[#333]">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Pessoa</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => (
              <tr key={tx.id} className="border-b border-[#222] hover:bg-[#252540]">
                <td className="px-4 py-2 text-gray-400">{tx.date}</td>
                <td className="px-4 py-2">{tx.merchant_name || tx.description}</td>
                <td className="px-4 py-2 capitalize text-gray-400">{tx.person}</td>
                <td className="px-4 py-2">
                  <select value={tx.category_id || ""}
                    onChange={(e) => updateCategory(tx.id, e.target.value)}
                    className="bg-[#0f0f1a] border border-[#333] rounded px-2 py-1 text-xs">
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className={`px-4 py-2 text-right font-medium ${tx.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                  R$ {Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Categories.tsx** (full CRUD + keyword rules)

```tsx
import { useEffect, useState } from "react";
import api from "../api/client";
import { Category } from "../types";

interface Rule { id: string; keyword: string; match_type: string; priority: number; }

export default function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", color: "#808080", icon: "❓", monthly_budget: "" });

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCats(r.data)); }, []);

  async function selectCat(cat: Category) {
    setSelected(cat);
    setForm({ name: cat.name, color: cat.color, icon: cat.icon, monthly_budget: String(cat.monthly_budget || "") });
    const r = await api.get<Rule[]>(`/categories/${cat.id}/rules`);
    setRules(r.data);
  }

  async function saveCategory() {
    const body = { ...form, monthly_budget: form.monthly_budget ? Number(form.monthly_budget) : null };
    if (selected) {
      await api.put(`/categories/${selected.id}`, body);
    } else {
      await api.post("/categories", body);
    }
    const r = await api.get<Category[]>("/categories");
    setCats(r.data); setEditing(false); setSelected(null);
  }

  async function deleteCategory(id: string) {
    if (!confirm("Remover categoria? Transações serão movidas para Outros.")) return;
    await api.delete(`/categories/${id}`);
    setCats((prev) => prev.filter((c) => c.id !== id));
    setSelected(null);
  }

  async function addRule() {
    if (!selected || !newKeyword.trim()) return;
    const r = await api.post(`/categories/${selected.id}/rules`, { keyword: newKeyword.trim().toUpperCase(), match_type: "contains", priority: 0 });
    setRules((prev) => [...prev, r.data]);
    setNewKeyword("");
  }

  async function deleteRule(ruleId: string) {
    if (!selected) return;
    await api.delete(`/categories/${selected.id}/rules/${ruleId}`);
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Categorias</h1>
        <button onClick={() => { setSelected(null); setForm({ name: "", color: "#808080", icon: "❓", monthly_budget: "" }); setEditing(true); }}
          className="bg-[#7c6af7] text-white px-4 py-2 rounded-lg text-sm">+ Nova</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cats.map((cat) => (
          <div key={cat.id} onClick={() => { selectCat(cat); setEditing(false); }}
            className={`bg-[#1a1a2e] rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:bg-[#252540] ${selected?.id === cat.id ? "ring-1 ring-[#7c6af7]" : ""}`}>
            <span className="text-2xl">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{cat.name}</p>
              <p className="text-xs text-gray-500">{cat.rule_count} regras</p>
            </div>
          </div>
        ))}
      </div>
      {(selected && !editing) && (
        <div className="bg-[#1a1a2e] rounded-xl p-5 space-y-4">
          <div className="flex justify-between">
            <h2 className="font-bold">{selected.icon} {selected.name}</h2>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="text-xs text-[#7c6af7] border border-[#7c6af7] px-3 py-1 rounded">Editar</button>
              <button onClick={() => deleteCategory(selected.id)} className="text-xs text-red-400 border border-red-400 px-3 py-1 rounded">Remover</button>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">Regras de categorização automática</p>
            <div className="space-y-1 mb-3">
              {rules.map((rule) => (
                <div key={rule.id} className="flex justify-between items-center bg-[#0f0f1a] px-3 py-1.5 rounded">
                  <span className="text-sm font-mono">{rule.keyword}</span>
                  <button onClick={() => deleteRule(rule.id)} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRule()}
                placeholder="Nova keyword (ex: SUPERMERCAD)"
                className="flex-1 bg-[#0f0f1a] border border-[#333] rounded px-3 py-1.5 text-sm" />
              <button onClick={addRule} className="bg-[#7c6af7] text-white px-4 py-1.5 rounded text-sm">Adicionar</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="bg-[#1a1a2e] rounded-xl p-5 space-y-3">
          <h2 className="font-bold">{selected ? "Editar" : "Nova"} categoria</h2>
          {[
            { label: "Nome", key: "name", type: "text" },
            { label: "Ícone (emoji)", key: "icon", type: "text" },
            { label: "Cor (hex)", key: "color", type: "text" },
            { label: "Orçamento mensal (R$)", key: "monthly_budget", type: "number" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs text-gray-400">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[#0f0f1a] border border-[#333] rounded px-3 py-1.5 text-sm mt-1" />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={saveCategory} className="bg-[#7c6af7] text-white px-5 py-2 rounded-lg text-sm">Salvar</button>
            <button onClick={() => setEditing(false)} className="text-gray-400 px-5 py-2 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create Plans.tsx**

```tsx
import { useEffect, useState } from "react";
import api from "../api/client";

interface PlanStatus {
  plan_id: string; name: string; goal_amount: number;
  target_date: string; months_remaining: number;
  category_budgets: Array<{
    category_id: string; category_name: string; color: string;
    monthly_limit: number; spent_this_month: number;
    percentage: number; over_budget: boolean;
  }>;
}

export default function Plans() {
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [statuses, setStatuses] = useState<PlanStatus[]>([]);

  useEffect(() => {
    api.get("/plans").then(async (r) => {
      setPlans(r.data);
      const s = await Promise.all(r.data.map((p: { id: string }) => api.get(`/plans/${p.id}/status`).then((r) => r.data)));
      setStatuses(s);
    });
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Planos de Economia</h1>
      {statuses.length === 0 && <p className="text-gray-400">Nenhum plano criado ainda.</p>}
      {statuses.map((plan) => (
        <div key={plan.plan_id} className="bg-[#1a1a2e] rounded-xl p-5 space-y-4">
          <div className="flex justify-between">
            <div>
              <h2 className="font-bold text-lg text-[#7c6af7]">{plan.name}</h2>
              <p className="text-gray-400 text-sm">Meta: R$ {plan.goal_amount.toLocaleString("pt-BR")} · {plan.months_remaining} meses restantes</p>
            </div>
          </div>
          <div className="space-y-3">
            {plan.category_budgets.map((b) => (
              <div key={b.category_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{b.category_name}</span>
                  <span className={b.over_budget ? "text-red-400" : "text-gray-400"}>
                    R$ {b.spent_this_month.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {b.monthly_limit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {b.over_budget && " ⚠️"}
                  </span>
                </div>
                <div className="bg-[#0f0f1a] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(b.percentage, 100)}%`,
                      background: b.over_budget ? "#e05c5c" : b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create Trends.tsx**

```tsx
import { useState } from "react";
import api from "../api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { usePersonStore } from "../store/person";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface MerchantTrend {
  merchant: string;
  growth_pct: number | null;
  monthly: Array<{ year: number; month: number; total: number; count: number }>;
  recent_transactions: Array<{ id: string; date: string; description: string; amount: number; person: string }>;
}

export default function Trends() {
  const { person } = usePersonStore();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MerchantTrend | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const r = await api.get(`/trends/merchant?q=${encodeURIComponent(query)}&person=${person}`);
    setData(r.data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Tendências</h1>
      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Buscar estabelecimento (ex: Uber, Supermercado...)"
          className="flex-1 bg-[#1a1a2e] border border-[#333] rounded-lg px-4 py-2 text-sm"
        />
        <button onClick={search} className="bg-[#7c6af7] text-white px-6 py-2 rounded-lg font-semibold">
          Buscar
        </button>
      </div>
      {loading && <p className="text-gray-400">Buscando...</p>}
      {data && (
        <div className="space-y-4">
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-lg">{data.merchant}</h2>
                {data.growth_pct != null && (
                  <p className={`text-sm ${data.growth_pct > 0 ? "text-red-400" : "text-green-400"}`}>
                    {data.growth_pct > 0 ? "↑" : "↓"} {Math.abs(data.growth_pct)}% vs. primeiro mês
                  </p>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly.map((m) => ({ name: MONTHS[m.month - 1], total: m.total }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} />
                <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }}
                  formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                />
                <Bar dataKey="total" fill="#7c6af7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#1a1a2e] rounded-xl p-4">
            <h3 className="text-sm text-gray-400 mb-3">Últimas transações</h3>
            <div className="space-y-2">
              {data.recent_transactions.map((t) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-gray-300">{t.date} · {t.description} · <span className="text-gray-500 capitalize">{t.person}</span></span>
                  <span className="text-red-400">R$ {Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build final**
```bash
cd frontend && npm run build
```
Expected: 0 TypeScript errors.

- [ ] **Step 6: Commit**
```bash
git commit -am "feat: Transactions, Categories, Plans, Trends pages complete"
```

---

## Phase 6: Docker + Deployment

### Task 16: Dockerfiles + nginx + docker-compose

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx.conf`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx.conf is copied from root context via docker-compose build context
```

Note: nginx.conf lives at root level. The frontend service in docker-compose.yml must set `build.context` to root and `build.dockerfile` to `frontend/Dockerfile`. See docker-compose Step 4 below.

- [ ] **Step 3: Create nginx.conf**

```nginx
server {
    listen 80;

    location /api/ {
        proxy_pass http://api:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Create docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: financas
      POSTGRES_USER: financas
      POSTGRES_PASSWORD: financas
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U financas"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://financas:financas@db:5432/financas

  frontend:
    build:
      context: .          # root context so nginx.conf is accessible
      dockerfile: frontend/Dockerfile
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
```

Also update `frontend/Dockerfile` last COPY line to:
```dockerfile
COPY nginx.conf /etc/nginx/conf.d/default.conf
```
(now works because build context is root, not `./frontend`)

- [ ] **Step 5: Create .env from .env.example**
```bash
cp .env.example .env
# Edit .env: set APP_PASSWORD and SECRET_KEY to real values
```

Generate SECRET_KEY:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

- [ ] **Step 6: Run Alembic migration via docker**
```bash
docker compose up db -d
docker compose run --rm api alembic upgrade head
```

- [ ] **Step 7: Start full stack**
```bash
docker compose up --build
```
Expected: app accessible at http://localhost

- [ ] **Step 8: End-to-end smoke test**
1. Open http://localhost → login page appears
2. Enter password from .env → redirect to dashboard
3. Go to Importar → drag PDF → see preview → confirm
4. Go to Dashboard → see gastos/renda/gráficos
5. Go to Tendências → buscar "Uber" → ver gráfico

- [ ] **Step 9: Commit**
```bash
git commit -am "feat: Docker Compose deployment (nginx + FastAPI + PostgreSQL)"
```

---

## Done ✅

Full stack running locally. To deploy on VPS:
```bash
# On VPS (Ubuntu)
git clone <repo> && cd financas
cp .env.example .env && nano .env   # set passwords
docker compose up -d --build
```
