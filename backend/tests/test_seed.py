import pytest
from app.seed import seed_categories
from app.models import Category, CategoryRule

def test_seed_creates_categories(client):
    from app.database import engine
    from sqlalchemy.orm import sessionmaker
    S = sessionmaker(bind=engine)
    db = S()
    seed_categories(db)
    cats = db.query(Category).all()
    names = [c.name for c in cats]
    assert "Alimentação" in names
    assert "Transporte" in names
    assert "Outros" in names
    rules = db.query(CategoryRule).all()
    assert len(rules) > 10
    db.close()
