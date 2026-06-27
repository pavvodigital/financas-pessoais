"""Custos fixos — despesas recorrentes (água, luz, internet, assinaturas).

O usuário marca quais recorrentes são fixos; a tela mostra o total fixo/mês.
Detecção: agrupa despesas por comerciante normalizado; o que aparece em
3+ meses vira candidato. Marcar cria um FixedCost com a chave normalizada.
"""
import re
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, FixedCost

router = APIRouter(prefix="/api/fixed-costs", tags=["fixed-costs"], dependencies=[Depends(verify_token)])


def _norm(s: str) -> str:
    s = (s or "").upper()
    s = re.sub(r"\d", "", s)
    s = re.sub(r"[^A-ZÁÉÍÓÚÃÕÂÊÔÇ ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:40]


def _add_months(year: int, month: int, k: int) -> tuple[int, int]:
    idx = year * 12 + (month - 1) + k
    return idx // 12, idx % 12 + 1


class FixedCostIn(BaseModel):
    label: str
    match_key: str
    person: Optional[str] = None
    expected_amount: Optional[float] = None


def _expenses(db: Session, person: Optional[str]) -> list[Transaction]:
    q = db.query(Transaction).filter(Transaction.amount < 0)
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    return q.all()


@router.get("")
def list_fixed_costs(
    person: Optional[str] = Query(None),
    months: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    window = [_add_months(now.year, now.month, -i) for i in range(months - 1, -1, -1)]
    window_set = set(window)

    txs = _expenses(db, person)
    # pré-computa norm de cada tx
    norm_cache = {t.id: _norm(t.merchant_name or t.description) for t in txs}

    fcs = db.query(FixedCost).filter(FixedCost.active == True).all()
    if person and person != "ambos":
        fcs = [f for f in fcs if f.person in (None, person)]
    fixed_keys = {f.match_key for f in fcs}

    def monthly_for_key(key: str, p: Optional[str]) -> dict[tuple[int, int], float]:
        bym: dict[tuple[int, int], float] = {}
        for t in txs:
            if norm_cache[t.id] != key:
                continue
            if p and t.person != p:
                continue
            ym = (t.date.year, t.date.month)
            bym[ym] = round(bym.get(ym, 0.0) + abs(float(t.amount)), 2)
        return bym

    fixed_out = []
    by_month_total: dict[tuple[int, int], float] = {ym: 0.0 for ym in window}
    monthly_total = 0.0
    for f in fcs:
        bym = monthly_for_key(f.match_key, f.person)
        in_window = {ym: v for ym, v in bym.items() if ym in window_set}
        avg = round(sum(in_window.values()) / len(in_window), 2) if in_window else 0.0
        rep = float(f.expected_amount) if f.expected_amount is not None else avg
        monthly_total += rep
        last_ym = (now.year, now.month)
        for ym, v in in_window.items():
            by_month_total[ym] = round(by_month_total[ym] + v, 2)
        fixed_out.append({
            "id": f.id,
            "label": f.label,
            "match_key": f.match_key,
            "person": f.person,
            "expected_amount": float(f.expected_amount) if f.expected_amount is not None else None,
            "avg_amount": avg,
            "representative": round(rep, 2),
            "this_month": in_window.get(last_ym, 0.0),
            "paid_this_month": last_ym in in_window,
            "months_seen": len(bym),
        })
    fixed_out.sort(key=lambda x: x["representative"], reverse=True)

    # candidatos: recorrentes (3+ meses) ainda não marcados
    by_key: dict[tuple[str, str], dict] = {}
    for t in txs:
        key = norm_cache[t.id]
        if not key or key in fixed_keys:
            continue
        kk = (key, t.person)
        slot = by_key.setdefault(kk, {"months": set(), "total": 0.0, "ex": t.description or ""})
        slot["months"].add((t.date.year, t.date.month))
        slot["total"] += abs(float(t.amount))
    candidates = []
    for (key, p), v in by_key.items():
        if len(v["months"]) >= 3:
            candidates.append({
                "match_key": key,
                "person": p,
                "example": v["ex"][:50],
                "months_seen": len(v["months"]),
                "avg_amount": round(v["total"] / len(v["months"]), 2),
            })
    candidates.sort(key=lambda x: (x["months_seen"], x["avg_amount"]), reverse=True)

    by_month_list = [
        {"year": y, "month": m, "amount": round(by_month_total[(y, m)], 2)}
        for (y, m) in window
    ]
    return {
        "monthly_total": round(monthly_total, 2),
        "fixed": fixed_out,
        "candidates": candidates[:20],
        "by_month": by_month_list,
    }


@router.post("")
def create_fixed_cost(body: FixedCostIn, db: Session = Depends(get_db)):
    fc = FixedCost(
        label=body.label.strip(),
        match_key=_norm(body.match_key),
        person=body.person if body.person and body.person != "ambos" else None,
        expected_amount=Decimal(str(body.expected_amount)) if body.expected_amount is not None else None,
    )
    db.add(fc)
    db.commit()
    db.refresh(fc)
    return {"id": fc.id, "label": fc.label, "match_key": fc.match_key}


@router.delete("/{fc_id}")
def delete_fixed_cost(fc_id: str, db: Session = Depends(get_db)):
    fc = db.get(FixedCost, fc_id)
    if not fc:
        raise HTTPException(status_code=404, detail="Custo fixo não encontrado")
    db.delete(fc)
    db.commit()
    return {"deleted": fc_id}
