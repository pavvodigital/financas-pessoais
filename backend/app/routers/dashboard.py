from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, Category
from app.schemas.dashboard import DashboardResponse, CategoryTotal, MonthlyTotal
from app.services.aggregates import monthly_totals

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
        """CC: credits offset charges (net fatura). Conta/manual: positivo = receita, negativo = despesa."""
        cc_net = sum(float(t.amount) for t in transactions if t.source == "credit_card")
        cc_expense = max(0.0, -cc_net)
        cc_income = max(0.0, cc_net)
        # Tudo que não é cartão (banco + lançamentos manuais) entra por sinal.
        non_cc_expense = abs(sum(float(t.amount) for t in transactions if t.amount < 0 and t.source != "credit_card"))
        non_cc_income = sum(float(t.amount) for t in transactions if t.amount > 0 and t.source != "credit_card")
        return cc_expense + non_cc_expense, cc_income + non_cc_income

    total_expense, total_income = _net_totals(txs)

    # Last month comparison (agregado em SQL — sem carregar o mês inteiro)
    if month == 1:
        prev_month, prev_year = 12, year - 1
    else:
        prev_month, prev_year = month - 1, year
    prev = monthly_totals(db, [(prev_year, prev_month)], person, source)
    prev_expense = prev[(prev_year, prev_month)]["expense"]
    vs_last = ((total_expense - prev_expense) / prev_expense * 100) if prev_expense else None

    # By category (excluding transfers — keeps pie chart focused on spending)
    non_transfer = [t for t in txs if t.category_id not in transfer_cat_ids]
    cat_totals: dict[str, float] = {}
    for tx in non_transfer:
        if tx.amount < 0 and tx.category_id:
            cat_totals[tx.category_id] = cat_totals.get(tx.category_id, 0) + abs(float(tx.amount))
    # Denominador = mesmo universo das fatias (gastos sem transferências),
    # senão os percentuais do pie não fecham 100%.
    gross_charge_total = abs(sum(float(t.amount) for t in non_transfer if t.amount < 0))
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

    # Monthly history (last 6 months) — uma query agregada, mesmos filtros
    hist_months = []
    for i in range(5, -1, -1):
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1
        hist_months.append((y, m))
    totals = monthly_totals(db, hist_months, person, source)
    history = [
        MonthlyTotal(
            year=y, month=m,
            total_expense=totals[(y, m)]["expense"],
            total_income=totals[(y, m)]["income"],
        )
        for (y, m) in hist_months
    ]

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

    totals = monthly_totals(db, months, person)
    cumulative = 0.0
    result = []
    for y, m in months:
        expense = totals[(y, m)]["expense"]
        income = totals[(y, m)]["income"]
        balance = round(income - expense, 2)
        cumulative = round(cumulative + balance, 2)
        result.append({
            "year": y, "month": m, "income": income,
            "expense": expense, "balance": balance, "cumulative": cumulative,
        })
    return result
