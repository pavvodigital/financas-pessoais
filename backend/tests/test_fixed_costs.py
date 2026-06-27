from datetime import date, datetime


def _token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]


def _months_back(n):
    now = datetime.now()
    idx = now.year * 12 + (now.month - 1) - n
    return idx // 12, idx % 12 + 1


def _tx(db, desc, amount, y, m, person="diogo", source="bank"):
    from app.models import Transaction
    db.add(Transaction(
        date=date(y, m, 10), description=desc, merchant_name=desc, amount=amount,
        type="expense" if amount < 0 else "income", person=person, source=source))
    db.commit()


def _seed(db):
    # CEMIG recorrente em 4 meses (custo fixo de luz)
    for n in range(4):
        y, m = _months_back(n)
        _tx(db, "CEMIG DISTRIBUICAO", -200.0, y, m)
    # Padaria só 1 mês -> não é recorrente
    y, m = _months_back(0)
    _tx(db, "PADARIA DO ZE", -15.0, y, m)


def test_detects_recurring_candidate(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db); db.close()

    data = client.get("/api/fixed-costs?person=diogo", headers={"Authorization": f"Bearer {_token(client)}"}).json()
    keys = [c["match_key"] for c in data["candidates"]]
    assert "CEMIG DISTRIBUICAO" in keys
    assert "PADARIA DO ZE" not in keys  # só 1 mês
    assert data["monthly_total"] == 0.0  # nada marcado ainda


def test_mark_fixed_then_total(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db); db.close()
    h = {"Authorization": f"Bearer {_token(client)}"}

    r = client.post("/api/fixed-costs", json={"label": "Luz", "match_key": "CEMIG DISTRIBUICAO", "person": "diogo"}, headers=h)
    assert r.status_code == 200

    data = client.get("/api/fixed-costs?person=diogo", headers=h).json()
    assert data["monthly_total"] == 200.0
    labels = [f["label"] for f in data["fixed"]]
    assert "Luz" in labels
    # saiu dos candidatos
    assert "CEMIG DISTRIBUICAO" not in [c["match_key"] for c in data["candidates"]]
    assert data["fixed"][0]["paid_this_month"] is True


def test_expected_amount_overrides_avg(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db); db.close()
    h = {"Authorization": f"Bearer {_token(client)}"}
    client.post("/api/fixed-costs", json={"label": "Luz", "match_key": "CEMIG DISTRIBUICAO", "expected_amount": 250.0}, headers=h)
    data = client.get("/api/fixed-costs", headers=h).json()
    assert data["monthly_total"] == 250.0


def test_substring_match_catches_variants(client):
    """Chave curta 'CEMIG' pega 'PIX QRS CEMIG' e 'INT CEMIG' (mesma conta)."""
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    for n in range(3):
        y, m = _months_back(n)
        _tx(db, "PIX QRS CEMIG DISTR", -100.0, y, m)
        _tx(db, "INT CEMIG DISTRIBUICA", -50.0, y, m)
    db.close()
    h = {"Authorization": f"Bearer {_token(client)}"}
    client.post("/api/fixed-costs", json={"label": "Luz", "match_key": "CEMIG"}, headers=h)
    data = client.get("/api/fixed-costs", headers=h).json()
    assert data["monthly_total"] == 150.0  # (100+50) por mes


def test_delete_fixed_cost(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _seed(db); db.close()
    h = {"Authorization": f"Bearer {_token(client)}"}
    fid = client.post("/api/fixed-costs", json={"label": "Luz", "match_key": "CEMIG DISTRIBUICAO"}, headers=h).json()["id"]
    assert client.delete(f"/api/fixed-costs/{fid}", headers=h).status_code == 200
    data = client.get("/api/fixed-costs", headers=h).json()
    assert data["fixed"] == []
