import uuid
import tempfile
import os
from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import verify_token
from app.services.pdf_parser import parse_credit_card_pdf, parse_statement_pdf
from app.services.categorizer import categorize_transaction
from app.schemas.transaction import (
    UploadPreviewResponse,
    TransactionPreview,
    UploadConfirmRequest,
)
from app.models import Transaction, UploadedFile, Category

router = APIRouter(
    prefix="/api/upload",
    tags=["upload"],
    dependencies=[Depends(verify_token)],
)

_temp_store: dict[str, dict] = {}


def _detect_type(filename: str) -> str:
    name = filename.lower()
    if "fatura" in name:
        return "credit_card"
    return "statement"


@router.post("", response_model=UploadPreviewResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    person: str = Form(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        file_type = _detect_type(file.filename or "")
        if file_type == "credit_card":
            raw_txs = parse_credit_card_pdf(tmp_path)
        else:
            raw_txs = parse_statement_pdf(tmp_path)
    finally:
        os.unlink(tmp_path)

    previews = []
    for tx in raw_txs:
        cat = categorize_transaction(tx, db)
        previews.append(
            TransactionPreview(
                date=tx["date"],
                description=tx["description"],
                merchant_name=tx.get("merchant_name"),
                amount=tx["amount"],
                category_name=cat.name if cat else None,
                source=tx["source"],
                raw_text=tx.get("raw_text"),
            )
        )

    temp_id = str(uuid.uuid4())
    _temp_store[temp_id] = {
        "previews": previews,
        "file_type": file_type,
        "filename": file.filename,
    }
    return UploadPreviewResponse(file_id_temp=temp_id, transactions=previews)


@router.post("/confirm")
def confirm_upload(req: UploadConfirmRequest, db: Session = Depends(get_db)):
    from datetime import datetime

    dates = [t.date for t in req.transactions]
    month = dates[0].month if dates else datetime.now().month
    year = dates[0].year if dates else datetime.now().year

    uploaded = UploadedFile(
        filename=req.filename,
        file_type=req.file_type,
        person=req.person,
        month=month,
        year=year,
        transaction_count=len(req.transactions),
    )
    db.add(uploaded)
    db.flush()

    cat_cache: dict[str, str | None] = {}

    def get_cat_id(name: str | None) -> str | None:
        if not name:
            return None
        if name not in cat_cache:
            cat = db.query(Category).filter(Category.name == name).first()
            cat_cache[name] = cat.id if cat else None
        return cat_cache[name]

    for tx in req.transactions:
        t = Transaction(
            date=tx.date,
            description=tx.description,
            merchant_name=tx.merchant_name,
            amount=tx.amount,
            type="expense" if tx.amount < 0 else "income",
            category_id=tx.category_id,
            person=req.person,
            source=tx.source,
            file_id=uploaded.id,
            raw_text=tx.raw_text,
        )
        db.add(t)

    db.commit()
    return {"saved": len(req.transactions), "file_id": uploaded.id}
