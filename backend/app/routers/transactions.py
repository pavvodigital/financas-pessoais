from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app.auth import verify_token
from app.models import Transaction, Category
from pydantic import BaseModel
from datetime import date

router = APIRouter(prefix="/api/transactions", tags=["transactions"], dependencies=[Depends(verify_token)])

class TransactionUpdate(BaseModel):
    category_id: Optional[str] = None
    person: Optional[str] = None

class TransactionCreate(BaseModel):
    date: date
    description: str
    amount: float
    category_id: Optional[str] = None
    person: str
    source: str = "manual"

def _tx_dict(t: Transaction, db: Session) -> dict:
    cat = db.query(Category).filter(Category.id == t.category_id).first() if t.category_id else None
    return {
        "id": t.id, "date": str(t.date), "description": t.description,
        "merchant_name": t.merchant_name, "amount": float(t.amount),
        "type": t.type, "person": t.person, "source": t.source,
        "category_id": t.category_id,
        "category_name": cat.name if cat else None,
        "category_color": cat.color if cat else None,
        "manually_categorized": t.manually_categorized,
    }

@router.get("")
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    person: Optional[str] = None,
    category_id: Optional[str] = None,
    source: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if month:
        q = q.filter(func.extract("month", Transaction.date) == month)
    if year:
        q = q.filter(func.extract("year", Transaction.date) == year)
    if person and person != "ambos":
        q = q.filter(Transaction.person == person)
    if category_id:
        q = q.filter(Transaction.category_id == category_id)
    if source:
        q = q.filter(Transaction.source == source)
    total = q.count()
    txs = q.order_by(Transaction.date.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [_tx_dict(t, db) for t in txs]}

@router.post("")
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    tx = Transaction(
        date=body.date, description=body.description, amount=body.amount,
        type="expense" if body.amount < 0 else "income",
        category_id=body.category_id, person=body.person, source=body.source,
    )
    db.add(tx); db.commit(); db.refresh(tx)
    return _tx_dict(tx, db)

@router.patch("/{tx_id}")
def update_transaction(tx_id: str, body: TransactionUpdate, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404)
    if body.category_id is not None:
        tx.category_id = body.category_id
        tx.manually_categorized = True
    if body.person is not None:
        tx.person = body.person
    db.commit()
    return _tx_dict(tx, db)
