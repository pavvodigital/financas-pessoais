from sqlalchemy.orm import Session
from app.models import Category, CategoryRule


def load_categorization_context(db: Session) -> tuple[list[CategoryRule], dict[str, Category]]:
    """Carrega regras + categorias uma vez. Um preview de fatura tem 100+
    transações; sem isso cada uma dispararia 2-3 queries próprias."""
    rules = (
        db.query(CategoryRule)
        .join(Category)
        .order_by(CategoryRule.priority.desc())
        .all()
    )
    categories = {c.name: c for c in db.query(Category).all()}
    return rules, categories


def categorize_transaction(
    tx: dict,
    db: Session,
    rules: list[CategoryRule] | None = None,
    categories: dict[str, Category] | None = None,
) -> Category | None:
    if rules is None or categories is None:
        rules, categories = load_categorization_context(db)

    # 1. Try Itaú category label
    itau_cat = tx.get("itau_category")
    if itau_cat and itau_cat in categories:
        return categories[itau_cat]

    # 2. Keyword matching — highest priority first
    desc = tx.get("description", "").upper()
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
    return categories.get("Outros")
