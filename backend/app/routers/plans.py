from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, datetime
from app.database import get_db
from app.auth import verify_token
from app.models import SavingsPlan, PlanCategoryBudget, Transaction, Category
from pydantic import BaseModel

router = APIRouter(prefix="/api/plans", tags=["plans"], dependencies=[Depends(verify_token)])

class BudgetItem(BaseModel):
    category_id: str
    monthly_limit: float

class PlanCreate(BaseModel):
    name: str
    goal_amount: float
    target_date: date
    category_budgets: list[BudgetItem] = []

def _plan_dict(plan: SavingsPlan) -> dict:
    return {
        "id": plan.id, "name": plan.name,
        "goal_amount": float(plan.goal_amount),
        "target_date": str(plan.target_date),
        "is_active": plan.is_active,
    }

@router.get("")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(SavingsPlan).filter(SavingsPlan.is_active == True).all()
    return [_plan_dict(p) for p in plans]

@router.post("")
def create_plan(body: PlanCreate, db: Session = Depends(get_db)):
    plan = SavingsPlan(name=body.name, goal_amount=body.goal_amount, target_date=body.target_date)
    db.add(plan); db.flush()
    for b in body.category_budgets:
        db.add(PlanCategoryBudget(plan_id=plan.id, category_id=b.category_id, monthly_limit=b.monthly_limit))
    db.commit(); db.refresh(plan)
    return _plan_dict(plan)

@router.put("/{plan_id}")
def update_plan(plan_id: str, body: PlanCreate, db: Session = Depends(get_db)):
    plan = db.query(SavingsPlan).filter(SavingsPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, detail="Plano não encontrado")
    plan.name = body.name; plan.goal_amount = body.goal_amount; plan.target_date = body.target_date
    db.query(PlanCategoryBudget).filter(PlanCategoryBudget.plan_id == plan_id).delete()
    for b in body.category_budgets:
        db.add(PlanCategoryBudget(plan_id=plan.id, category_id=b.category_id, monthly_limit=b.monthly_limit))
    db.commit()
    return _plan_dict(plan)

@router.get("/{plan_id}/status")
def plan_status(plan_id: str, db: Session = Depends(get_db)):
    plan = db.query(SavingsPlan).filter(SavingsPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, detail="Plano não encontrado")
    now = datetime.now()
    budgets = db.query(PlanCategoryBudget).filter(PlanCategoryBudget.plan_id == plan_id).all()
    category_status = []
    for budget in budgets:
        spent = abs(sum(
            float(t.amount) for t in db.query(Transaction).filter(
                Transaction.category_id == budget.category_id,
                Transaction.amount < 0,
                func.extract("month", Transaction.date) == now.month,
                func.extract("year", Transaction.date) == now.year,
            ).all()
        ))
        cat = db.query(Category).filter(Category.id == budget.category_id).first()
        monthly_limit = float(budget.monthly_limit)
        category_status.append({
            "category_id": budget.category_id,
            "category_name": cat.name if cat else None,
            "color": cat.color if cat else None,
            "monthly_limit": monthly_limit,
            "spent_this_month": round(spent, 2),
            "percentage": round(spent / monthly_limit * 100, 1) if monthly_limit else 0,
            "over_budget": spent > monthly_limit,
        })
    months_remaining = max(1, (plan.target_date.year - now.year) * 12 + (plan.target_date.month - now.month))
    return {
        "plan_id": plan_id,
        "name": plan.name,
        "goal_amount": float(plan.goal_amount),
        "target_date": str(plan.target_date),
        "months_remaining": months_remaining,
        "category_budgets": category_status,
    }
