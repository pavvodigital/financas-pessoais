"""Agregação mensal de transações direto no SQL.

Antes, dashboard/balance-history/outlook carregavam TODAS as transações de
cada mês em Python (8-12 queries por request, cada uma materializando ORM).
Aqui uma única query agrupada resolve o intervalo inteiro.

Convenção de totais (a mesma do dashboard):
- Cartão: net da fatura (créditos abatem compras). Net negativo = despesa.
- Conta/manual: positivo = receita, negativo = despesa, por sinal.
"""
import calendar
from datetime import date
from typing import Optional
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from app.models import Transaction


def monthly_totals(
    db: Session,
    months: list[tuple[int, int]],
    person: Optional[str] = None,
    source: Optional[str] = None,
) -> dict[tuple[int, int], dict[str, float]]:
    """Totais de despesa/receita por mês para a lista de (ano, mês) pedida.

    Retorna {(ano, mês): {"expense": float, "income": float}} com zeros para
    meses sem transação.
    """
    if not months:
        return {}
    first = min(months)
    last = max(months)
    start = date(first[0], first[1], 1)
    end = date(last[0], last[1], calendar.monthrange(last[0], last[1])[1])

    ycol = func.extract("year", Transaction.date).label("y")
    mcol = func.extract("month", Transaction.date).label("m")
    is_cc = Transaction.source == "credit_card"
    q = db.query(
        ycol,
        mcol,
        func.coalesce(func.sum(case((is_cc, Transaction.amount), else_=0)), 0).label("cc_net"),
        func.coalesce(func.sum(case((~is_cc & (Transaction.amount < 0), Transaction.amount), else_=0)), 0).label("other_neg"),
        func.coalesce(func.sum(case((~is_cc & (Transaction.amount > 0), Transaction.amount), else_=0)), 0).label("other_pos"),
    ).filter(Transaction.date >= start, Transaction.date <= end)
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    if source:
        q = q.filter(Transaction.source == source)
    rows = q.group_by(ycol, mcol).all()

    out = {ym: {"expense": 0.0, "income": 0.0} for ym in months}
    for r in rows:
        ym = (int(r.y), int(r.m))
        if ym not in out:
            continue  # mês dentro do range de datas mas fora da lista pedida
        cc_net = float(r.cc_net)
        expense = max(0.0, -cc_net) + abs(float(r.other_neg))
        income = max(0.0, cc_net) + float(r.other_pos)
        out[ym] = {"expense": round(expense, 2), "income": round(income, 2)}
    return out
