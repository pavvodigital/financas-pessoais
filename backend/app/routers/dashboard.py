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
    source: str = Query(default=None),
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
    if source:
        q = q.filter(Transaction.source == source)

    txs = q.all()

    # Exclude "Transferências" only from the category breakdown (pie chart).
    # KPI totals use all transactions so income reflects real cash inflows
    # (e.g. business withdrawals via PIX) and expenses reflect real outflows.
    transfer_cat_ids = {
        r[0] for r in db.query(Category.id).filter(Category.name == "Transferências").all()
    }

    def _net_totals(transactions):
        """CC: credits offset charges (net fatura). Bank: positives = income, negatives = expense."""
        cc_net = sum(float(t.amount) for t in transactions if t.source == "credit_card")
        cc_expense = max(0.0, -cc_net)
        cc_income = max(0.0, cc_net)
        bank_expense = abs(sum(float(t.amount) for t in transactions if t.amount < 0 and t.source == "bank"))
        bank_income = sum(float(t.amount) for t in transactions if t.amount > 0 and t.source == "bank")
        return cc_expense + bank_expense, cc_income + bank_income

    total_expense, total_income = _net_totals(txs)
    # Gross CC charges used as denominator for pie chart percentages
    gross_charge_total = abs(sum(float(t.amount) for t in txs if t.amount < 0))

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
    if source:
        prev_q = prev_q.filter(Transaction.source == source)
    prev_txs = prev_q.all()
    prev_expense, _ = _net_totals(prev_txs)
    vs_last = ((total_expense - prev_expense) / prev_expense * 100) if prev_expense else None

    # By category (excluding transfers — keeps pie chart focused on spending)
    non_transfer = [t for t in txs if t.category_id not in transfer_cat_ids]
    cat_totals: dict[str, float] = {}
    for tx in non_transfer:
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
                percentage=round(total / gross_charge_total * 100, 1) if gross_charge_total else 0,
            ))

    # Monthly history (last 6 months) — apply same person/source filters
    history = []
    for i in range(5, -1, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        hq = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
        )
        if person and person != "ambos":
            hq = hq.filter(Transaction.person == person)
        if source:
            hq = hq.filter(Transaction.source == source)
        ht = hq.all()
        exp_h, inc_h = _net_totals(ht)
        history.append(MonthlyTotal(
            year=y, month=m,
            total_expense=round(exp_h, 2),
            total_income=round(inc_h, 2),
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
        cc_net = sum(float(t.amount) for t in txs if t.source == "credit_card")
        expense = round(max(0.0, -cc_net) + abs(sum(float(t.amount) for t in txs if t.amount < 0 and t.source == "bank")), 2)
        income = round(max(0.0, cc_net) + sum(float(t.amount) for t in txs if t.amount > 0 and t.source == "bank"), 2)
        balance = round(income - expense, 2)
        cumulative = round(cumulative + balance, 2)
        result.append({
            "year": y, "month": m, "income": income,
            "expense": expense, "balance": balance, "cumulative": cumulative,
        })
    return result
