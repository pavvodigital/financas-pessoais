"""Parcelas (installments) — quanto ainda falta pagar, distribuído no tempo.

Cada fatura re-importa a mesma compra parcelada como uma linha nova
(AMAZON 01/12 em Jan, 02/12 em Fev, ...). Para não contar em dobro,
agrupamos por compra e usamos a parcela MAIS avançada já vista
(max installment_current). O que falta = (total - current) * valor_parcela.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction

router = APIRouter(prefix="/api/installments", tags=["installments"], dependencies=[Depends(verify_token)])


def _add_months(year: int, month: int, k: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + k
    return idx // 12, idx % 12 + 1


def _schedule(rows: list[Transaction]) -> dict:
    """Dedup compras parceladas e projeta o que falta mês a mês."""
    # Chave estável entre faturas: pessoa + comerciante + data da compra +
    # total de parcelas + valor. O valor entra porque o mesmo comerciante pode
    # ter duas compras simultâneas com mesmo total/data (ex.: 2x MERCADOLIVRE
    # 3/12 de R$77,51 e R$45,67) — sem o valor elas colapsariam numa só.
    groups: dict[tuple, Transaction] = {}
    for t in rows:
        key = (t.person, t.merchant_name, t.original_purchase_date, t.installment_total, round(abs(float(t.amount)), 2))
        cur = groups.get(key)
        if cur is None or (t.installment_current or 0) > (cur.installment_current or 0):
            groups[key] = t

    items: list[dict] = []
    by_month: dict[tuple[int, int], dict] = {}
    total_remaining = 0.0

    for t in groups.values():
        current = t.installment_current or 0
        total = t.installment_total or 0
        remaining_count = total - current
        if remaining_count <= 0:
            continue  # parcela já quitada
        per = abs(float(t.amount))
        remaining_amount = round(remaining_count * per, 2)
        total_remaining += remaining_amount

        # A parcela `current` foi cobrada na fatura cujo mês é t.date.
        # As restantes caem nos meses seguintes.
        base_y, base_m = t.date.year, t.date.month
        ndy, ndm = _add_months(base_y, base_m, 1)
        for k in range(1, remaining_count + 1):
            y, m = _add_months(base_y, base_m, k)
            slot = by_month.setdefault((y, m), {"amount": 0.0, "count": 0})
            slot["amount"] = round(slot["amount"] + per, 2)
            slot["count"] += 1

        items.append({
            "merchant_name": t.merchant_name,
            "description": t.description,
            "installment_current": current,
            "installment_total": total,
            "per_amount": round(per, 2),
            "remaining_count": remaining_count,
            "remaining_amount": remaining_amount,
            "original_purchase_date": str(t.original_purchase_date) if t.original_purchase_date else None,
            "next_due_year": ndy,
            "next_due_month": ndm,
        })

    items.sort(key=lambda x: x["remaining_amount"], reverse=True)
    return {
        "items": items,
        "by_month": by_month,
        "total_remaining": round(total_remaining, 2),
    }


def _installment_rows(db: Session, person: Optional[str]) -> list[Transaction]:
    q = db.query(Transaction).filter(
        Transaction.source == "credit_card",
        Transaction.installment_total.isnot(None),
    )
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    return q.all()


def _month_expense(db: Session, year: int, month: int, person: Optional[str]) -> float:
    """Gasto realizado no mês: cartão como net da fatura + débitos da conta."""
    q = db.query(Transaction).filter(
        func.extract("year", Transaction.date) == year,
        func.extract("month", Transaction.date) == month,
    )
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    txs = q.all()
    cc_net = sum(float(t.amount) for t in txs if t.source == "credit_card")
    cc_expense = max(0.0, -cc_net)
    non_cc_expense = abs(sum(float(t.amount) for t in txs if t.amount < 0 and t.source != "credit_card"))
    return round(cc_expense + non_cc_expense, 2)


@router.get("")
def list_installments(
    person: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    sched = _schedule(_installment_rows(db, person))
    by_month_list = [
        {"year": y, "month": m, "amount": round(v["amount"], 2), "count": v["count"]}
        for (y, m), v in sorted(sched["by_month"].items())
    ]
    # "Próximo mês" = primeiro mês do cronograma agregado (mês-calendário real).
    next_month_load = by_month_list[0]["amount"] if by_month_list else 0.0
    return {
        "total_remaining": sched["total_remaining"],
        "next_month_load": round(next_month_load, 2),
        "active_count": len(sched["items"]),
        "items": sched["items"],
        "by_month": by_month_list,
    }


@router.get("/outlook")
def monthly_outlook(
    person: Optional[str] = Query(None),
    past: int = Query(6, ge=0, le=24),
    future: int = Query(12, ge=1, le=36),
    db: Session = Depends(get_db),
):
    """Visão mês a mês: gasto realizado (passado) + parcelas comprometidas (futuro).

    Meses passados e o atual mostram o gasto real já lançado. Meses futuros
    mostram só o que já está comprometido em parcelas de dívidas existentes
    (não prevê compras novas).
    """
    now = datetime.now()
    sched = _schedule(_installment_rows(db, person))
    committed = sched["by_month"]  # {(y,m): {amount,count}}

    months = []
    # passado + mês atual: realizado
    for i in range(past, -1, -1):
        y, m = _add_months(now.year, now.month, -i)
        months.append({
            "year": y, "month": m, "is_future": False,
            "realized": _month_expense(db, y, m, person),
            "committed": None,
        })
    # futuro: parcelas comprometidas
    for j in range(1, future + 1):
        y, m = _add_months(now.year, now.month, j)
        slot = committed.get((y, m))
        months.append({
            "year": y, "month": m, "is_future": True,
            "realized": None,
            "committed": round(slot["amount"], 2) if slot else 0.0,
        })

    return {
        "total_remaining": sched["total_remaining"],
        "months": months,
    }
