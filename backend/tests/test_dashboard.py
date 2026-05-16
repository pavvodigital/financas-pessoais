from datetime import date

def seed_tx(db, amount, category_id=None, month=5, year=2026, person="diogo"):
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
    seed_tx(db, 4000.0, cat.id)
    db.close()

    token = get_token(client)
    resp = client.get("/api/dashboard?month=5&year=2026", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_expense"] == 300.0
    assert data["total_income"] == 4000.0
