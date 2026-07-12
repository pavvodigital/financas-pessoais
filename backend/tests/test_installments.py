from datetime import date


def _token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]


def _cc_tx(db, merchant, current, total, per, billing, orig, person="diogo"):
    """Insert one credit_card installment row as a fatura would (amount negative)."""
    from app.models import Transaction
    db.add(Transaction(
        date=billing,
        description=merchant,
        merchant_name=merchant,
        amount=-per,
        type="expense",
        person=person,
        source="credit_card",
        installment_current=current,
        installment_total=total,
        original_purchase_date=orig,
    ))
    db.commit()


def _seed(db):
    orig_a = date(2026, 1, 10)
    # Purchase A: AMAZON 12x, R$100 — appears in Jan, Fev, Mar faturas (1,2,3/12)
    _cc_tx(db, "AMAZON", 1, 12, 100.0, date(2026, 1, 9), orig_a)
    _cc_tx(db, "AMAZON", 2, 12, 100.0, date(2026, 2, 9), orig_a)
    _cc_tx(db, "AMAZON", 3, 12, 100.0, date(2026, 3, 9), orig_a)
    # Purchase B: SPOTIFY 3x, R$30 — fully paid (3/3) → excluded
    orig_b = date(2026, 1, 5)
    _cc_tx(db, "SPOTIFY", 3, 3, 30.0, date(2026, 3, 9), orig_b)
    # Purchase C: LIS only, 4x R$50, parcela 1/4
    _cc_tx(db, "ZARA", 1, 4, 50.0, date(2026, 3, 9), date(2026, 3, 1), person="lis")


def test_remaining_dedupes_and_excludes_paid(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db)
    db.close()

    r = client.get("/api/installments?person=diogo", headers={"Authorization": f"Bearer {_token(client)}"})
    assert r.status_code == 200
    data = r.json()
    # Only AMAZON active: (12-3)*100 = 900. SPOTIFY paid → excluded.
    assert data["active_count"] == 1
    assert data["total_remaining"] == 900.0
    assert data["items"][0]["merchant_name"] == "AMAZON"
    assert data["items"][0]["remaining_count"] == 9
    # next_month_load = próximo mês-calendário a partir de hoje. AMAZON (base
    # Mar/26) tem parcelas Abr–Dez/26; vale 100 se o próximo mês cai nesse range.
    from datetime import datetime
    from app.routers.installments import _add_months
    ny, nm = _add_months(datetime.now().year, datetime.now().month, 1)
    expected = 100.0 if (2026, 4) <= (ny, nm) <= (2026, 12) else 0.0
    assert data["next_month_load"] == expected


def test_by_month_layout(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db)
    db.close()

    data = client.get("/api/installments?person=diogo", headers={"Authorization": f"Bearer {_token(client)}"}).json()
    by_month = data["by_month"]
    # Parcela 3/12 cobrada em Mar/2026 → restantes 9 caem Abr..Dez 2026
    assert by_month[0] == {"year": 2026, "month": 4, "amount": 100.0, "count": 1}
    assert len(by_month) == 9
    assert by_month[-1]["month"] == 12
    assert sum(m["amount"] for m in by_month) == 900.0


def test_two_concurrent_purchases_same_merchant_not_merged(client):
    """Mesmo comerciante, mesmo total/data, valores diferentes = 2 compras.
    Não podem colapsar numa só (bug pego com dados reais: 2x MERCADOLIVRE 3/12)."""
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    orig = date(2026, 1, 10)
    _cc_tx(db, "MERCADOLIVRE", 3, 12, 77.51, date(2026, 3, 9), orig)
    _cc_tx(db, "MERCADOLIVRE", 3, 12, 45.67, date(2026, 3, 9), orig)
    db.close()

    data = client.get("/api/installments?person=diogo", headers={"Authorization": f"Bearer {_token(client)}"}).json()
    assert data["active_count"] == 2
    # (12-3) * (77.51 + 45.67) = 9 * 123.18 = 1108.62
    assert data["total_remaining"] == 1108.62


def test_person_filter_includes_lis_when_ambos(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db)
    db.close()

    data = client.get("/api/installments", headers={"Authorization": f"Bearer {_token(client)}"}).json()
    # AMAZON 900 + ZARA (4-1)*50=150 = 1050
    assert data["total_remaining"] == 1050.0
    assert data["active_count"] == 2


def test_outlook_shape_and_consistency(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db)
    db.close()

    h = {"Authorization": f"Bearer {_token(client)}"}
    data = client.get("/api/installments/outlook?person=diogo&past=6&future=12", headers=h).json()
    months = data["months"]
    # past+atual = 7 meses realizados, 12 futuros
    assert len(months) == 7 + 12
    assert sum(1 for m in months if not m["is_future"]) == 7
    assert sum(1 for m in months if m["is_future"]) == 12
    # passado/atual: realized preenchido, committed nulo
    for m in months:
        if m["is_future"]:
            assert m["realized"] is None and m["committed"] is not None
        else:
            assert m["committed"] is None and m["realized"] >= 0
    # total bate com o endpoint principal; comprometido futuro nunca passa do total
    assert data["total_remaining"] == 900.0
    assert sum(m["committed"] for m in months if m["is_future"]) <= 900.0
