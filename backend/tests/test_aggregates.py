from datetime import date

from app.services.aggregates import monthly_totals


def _tx(db, amount, source, y, m, person="diogo"):
    from app.models import Transaction
    db.add(Transaction(
        date=date(y, m, 15), description="T", amount=amount,
        type="expense" if amount < 0 else "income",
        person=person, source=source,
    ))
    db.commit()


def test_monthly_totals_cc_net_and_bank_by_sign(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    # Jan: cartão -300 compras +100 estorno (net -200 = despesa 200); banco -50 e +1000
    _tx(db, -300.0, "credit_card", 2026, 1)
    _tx(db, 100.0, "credit_card", 2026, 1)
    _tx(db, -50.0, "bank", 2026, 1)
    _tx(db, 1000.0, "bank", 2026, 1)
    # Fev: só manual -80 (manual conta por sinal, igual banco)
    _tx(db, -80.0, "manual", 2026, 2)

    out = monthly_totals(db, [(2026, 1), (2026, 2), (2026, 3)], person="diogo")
    assert out[(2026, 1)] == {"expense": 250.0, "income": 1000.0}
    assert out[(2026, 2)] == {"expense": 80.0, "income": 0.0}
    assert out[(2026, 3)] == {"expense": 0.0, "income": 0.0}  # mês vazio = zeros
    db.close()


def test_monthly_totals_person_and_source_filters(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    db = sessionmaker(bind=engine)()
    _tx(db, -100.0, "bank", 2026, 1, person="diogo")
    _tx(db, -40.0, "bank", 2026, 1, person="lis")
    _tx(db, -25.0, "credit_card", 2026, 1, person="diogo")

    only_diogo = monthly_totals(db, [(2026, 1)], person="diogo")
    assert only_diogo[(2026, 1)]["expense"] == 125.0
    only_bank = monthly_totals(db, [(2026, 1)], source="bank")
    assert only_bank[(2026, 1)]["expense"] == 140.0
    db.close()
