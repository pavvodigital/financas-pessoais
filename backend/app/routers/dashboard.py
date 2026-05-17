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
    category_id: str = Query(default=None),
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
    total_expense = abs(sum(float(t.amount) for t in txs if t.amount < 0))
    total_income = sum(float(t.amount) for t in txs if t.amount > 0)

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
    prev_expense = abs(sum(float(t.amount) for t in prev_q.all() if t.amount < 0))
    vs_last = ((total_expense - prev_expense) / prev_expense * 100) if prev_expense else None

    # By category
    cat_totals: dict[str, float] = {}
    for tx in txs:
        if tx.amount < 0 and tx.category_id:
            cat_totals[tx.category_id] = cat_totals.get(tx.category_id, 0) + abs(float(tx.amount))
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
            total_expense=round(abs(sum(float(t.amount) for t in ht if t.amount < 0)), 2),
            total_income=round(sum(float(t.amount) for t in ht if t.amount > 0), 2),
        ))

    recent_q = sorted(txs, key=lambda x: x.date, reverse=True)
    if category_id:
        recent_q = [t for t in recent_q if t.category_id == category_id]
    recent = [{
        "id": t.id, "date": str(t.date), "description": t.description,
        "merchant_name": t.merchant_name,
        "amount": float(t.amount), "person": t.person,
        "category_id": t.category_id,
    } for t in recent_q[:20]]

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


@router.get("/balance-history")
def balance_history(person: str = Query(default="ambos"), db: Session = Depends(get_db)):
    from datetime import date as date_type
    today = date_type.today()
    months = []
    for i in range(11, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))

    cumulative = 0.0
    result = []
    for y, m in months:
        q = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
        )
        if person != "ambos":
            q = q.filter(Transaction.person == person)
        txs = q.all()
        income = round(sum(float(t.amount) for t in txs if t.amount > 0), 2)
        expense = round(abs(sum(float(t.amount) for t in txs if t.amount < 0)), 2)
        balance = round(income - expense, 2)
        cumulative = round(cumulative + balance, 2)
        result.append({
            "year": y, "month": m, "income": income,
            "expense": expense, "balance": balance, "cumulative": cumulative,
        })
    return result
