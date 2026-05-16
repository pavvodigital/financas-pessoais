from sqlalchemy.orm import Session
from app.models import Category, CategoryRule

def categorize_transaction(tx: dict, db: Session) -> Category | None:
    # 1. Try Itaú category label
    if tx.get("itau_category"):
        cat = db.query(Category).filter(Category.name == tx["itau_category"]).first()
        if cat:
            return cat

    # 2. Keyword matching — highest priority first
    desc = tx.get("description", "").upper()
    rules = (
        db.query(CategoryRule)
        .join(Category)
        .order_by(CategoryRule.priority.desc())
        .all()
    )
    for rule in rules:
        kw = rule.keyword.upper()
        matched = False
        if rule.match_type == "contains" and kw in desc:
            matched = True
        elif rule.match_type == "starts_with" and desc.startswith(kw):
            matched = True
        elif rule.match_type == "exact" and desc == kw:
            matched = True
        if matched:
            return rule.category

    # 3. Fallback to Outros
    return db.query(Category).filter(Category.name == "Outros").first()
