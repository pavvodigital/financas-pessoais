import os
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.services.categorizer import categorize_transaction
from app.models import Category, CategoryRule

def test_categorize_by_itau_category(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "DL*UberRides", "itau_category": "Transporte", "source": "credit_card"}
    result = categorize_transaction(tx, db)
    assert result is not None
    assert result.name == "Transporte"
    db.close()

def test_categorize_by_keyword(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "DA TIM CELU 52472140000", "itau_category": None, "source": "bank"}
    result = categorize_transaction(tx, db)
    assert result is not None
    assert result.name == "Telecomunicações"
    db.close()

def test_categorize_fallback_to_outros(client, setup_db):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    from app.seed import seed_categories
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    tx = {"description": "XYZXYZ UNKNOWN", "itau_category": None, "source": "bank"}
    result = categorize_transaction(tx, db)
    assert result.name == "Outros"
    db.close()
