from app.models import Category, Transaction, SavingsPlan


def test_models_importable():
    assert Category.__tablename__ == "categories"
    assert Transaction.__tablename__ == "transactions"
    assert SavingsPlan.__tablename__ == "savings_plans"
