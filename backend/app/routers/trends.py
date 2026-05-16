from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction
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
        total = abs(sum(float(t.amount) for t in q.all()))
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
        total = abs(sum(float(t.amount) for t in txs))
        monthly.append({"year": y, "month": m, "total": round(total, 2), "count": len(txs)})
        all_txs.extend(txs)

    first_nonzero = next((mo["total"] for mo in monthly if mo["total"] > 0), 0)
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
