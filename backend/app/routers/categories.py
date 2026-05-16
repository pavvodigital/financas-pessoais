from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Category, CategoryRule, Transaction
from pydantic import BaseModel

router = APIRouter(prefix="/api/categories", tags=["categories"], dependencies=[Depends(verify_token)])

class CategoryCreate(BaseModel):
    name: str
    color: str = "#808080"
    icon: str = "❓"
    monthly_budget: Optional[float] = None

class RuleCreate(BaseModel):
    keyword: str
    match_type: str = "contains"
    priority: int = 0

@router.get("")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    return [{"id": c.id, "name": c.name, "color": c.color, "icon": c.icon,
             "monthly_budget": float(c.monthly_budget) if c.monthly_budget else None,
             "rule_count": len(c.rules)} for c in cats]

@router.post("")
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    cat = Category(**body.model_dump())
    db.add(cat); db.commit(); db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "color": cat.color, "icon": cat.icon, "monthly_budget": cat.monthly_budget}

@router.put("/{cat_id}")
def update_category(cat_id: str, body: CategoryCreate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404)
    for k, v in body.model_dump().items():
        setattr(cat, k, v)
    db.commit()
    return {"id": cat.id, "name": cat.name, "color": cat.color, "icon": cat.icon, "monthly_budget": cat.monthly_budget}

@router.delete("/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(404)
    outros = db.query(Category).filter(Category.name == "Outros").first()
    db.query(Transaction).filter(Transaction.category_id == cat_id).update({"category_id": outros.id if outros else None})
    db.delete(cat); db.commit()
    return {"ok": True}

@router.get("/{cat_id}/rules")
def get_rules(cat_id: str, db: Session = Depends(get_db)):
    rules = db.query(CategoryRule).filter(CategoryRule.category_id == cat_id).all()
    return [{"id": r.id, "keyword": r.keyword, "match_type": r.match_type, "priority": r.priority} for r in rules]

@router.post("/{cat_id}/rules")
def add_rule(cat_id: str, body: RuleCreate, db: Session = Depends(get_db)):
    rule = CategoryRule(category_id=cat_id, **body.model_dump())
    db.add(rule); db.commit(); db.refresh(rule)
    return {"id": rule.id, "keyword": rule.keyword, "match_type": rule.match_type, "priority": rule.priority}

@router.delete("/{cat_id}/rules/{rule_id}")
def delete_rule(cat_id: str, rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(CategoryRule).filter(CategoryRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404)
    db.delete(rule); db.commit()
    return {"ok": True}
