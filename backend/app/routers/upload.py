import uuid
import tempfile
import os
import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.database import get_db
from app.auth import verify_token
from app.services.pdf_parser import parse_credit_card_pdf, parse_statement_pdf
from app.services.categorizer import categorize_transaction
from app.schemas.transaction import (
    UploadPreviewResponse,
    TransactionPreview,
    UploadConfirmRequest,
)
from app.models import Transaction, UploadedFile

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


def _detect_bank(filename: str, content: bytes) -> str:
    name = filename.lower()
    if "itau" in name:
        return "itau"
    # PDFs use compressed streams — parse page text for reliable markers
    import io
    import pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            if pdf.pages:
                text = pdf.pages[0].extract_text() or ""
                # "Vencimento:" is present on every Itaú fatura page header
                if "Vencimento:" in text:
                    return "itau"
    except Exception:
        pass
    return "unknown"


def _md5(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()


@router.get("/files")
def list_uploads(db: Session = Depends(get_db)):
    files = db.execute(
        select(UploadedFile).order_by(UploadedFile.imported_at.desc())
    ).scalars().all()
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "file_type": f.file_type,
            "person": f.person,
            "month": f.month,
            "year": f.year,
            "imported_at": f.imported_at.isoformat(),
            "transaction_count": f.transaction_count,
        }
        for f in files
    ]


@router.delete("/files/{file_id}")
def delete_upload(file_id: str, db: Session = Depends(get_db)):
    f = db.get(UploadedFile, file_id)
    if not f:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    db.delete(f)
    db.commit()
    return {"deleted": file_id}


@router.post("", response_model=UploadPreviewResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    person: str = Form(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    bank = _detect_bank(file.filename or "", content)
    if bank == "unknown":
        raise HTTPException(status_code=422, detail="Banco não suportado. Apenas arquivos Itaú são aceitos.")
    file_hash = _md5(content)

    # Duplicate detection
    existing = db.execute(
        select(UploadedFile).where(UploadedFile.file_hash == file_hash)
    ).scalar_one_or_none()
    duplicate_of = existing.id if existing else None

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
                installment_current=tx.get("installment_current"),
                installment_total=tx.get("installment_total"),
                original_purchase_date=tx.get("original_purchase_date"),
            )
        )

    # Extract billing month/year from vencimento (credit card) or most common tx month (statement)
    billing_month, billing_year = None, None
    if file_type == "credit_card":
        import pdfplumber, io, re as _re
        _VENC_RE = _re.compile(r"Vencimento:\s*\d{2}/(\d{2})/(\d{4})")
        try:
            with pdfplumber.open(io.BytesIO(content)) as _pdf:
                for _page in _pdf.pages:
                    _m = _VENC_RE.search(_page.extract_text() or "")
                    if _m:
                        billing_month, billing_year = int(_m.group(1)), int(_m.group(2))
                        break
        except Exception:
            pass
    else:
        # Use most common (month, year) among transactions
        from collections import Counter
        counts = Counter((p.date.month, p.date.year) for p in previews if p.date)
        if counts:
            (billing_month, billing_year), _ = counts.most_common(1)[0]
    if not billing_month:
        # Fallback: parse filename e.g. itau_extrato_012026.pdf → month=01 year=2026
        import re as _re
        _fn = file.filename or ""
        _fn_m = _re.search(r"(\d{2})(\d{4})", _fn)
        if _fn_m:
            billing_month, billing_year = int(_fn_m.group(1)), int(_fn_m.group(2))
    if not billing_month:
        _now = __import__("datetime").datetime.now()
        billing_month, billing_year = _now.month, _now.year

    temp_id = str(uuid.uuid4())
    _temp_store[temp_id] = {
        "previews": previews,
        "file_type": file_type,
        "filename": file.filename,
        "file_hash": file_hash,
        "billing_month": billing_month,
        "billing_year": billing_year,
    }
    return UploadPreviewResponse(
        file_id_temp=temp_id,
        transactions=previews,
        duplicate_of=duplicate_of,
    )


@router.post("/confirm")
def confirm_upload(req: UploadConfirmRequest, db: Session = Depends(get_db)):
    from datetime import datetime

    if req.file_id_temp not in _temp_store:
        raise HTTPException(status_code=422, detail="file_id_temp inválido ou expirado")
    stored = _temp_store.pop(req.file_id_temp)
    file_hash = stored.get("file_hash")

    month = stored.get("billing_month") or datetime.now().month
    year = stored.get("billing_year") or datetime.now().year

    uploaded = UploadedFile(
        filename=req.filename,
        file_type=req.file_type,
        person=req.person,
        month=month,
        year=year,
        transaction_count=len(req.transactions),
        file_hash=file_hash,
    )
    db.add(uploaded)
    db.flush()

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
            installment_current=tx.installment_current,
            installment_total=tx.installment_total,
            original_purchase_date=tx.original_purchase_date,
        )
        db.add(t)

    db.commit()
    return {"saved": len(req.transactions), "file_id": uploaded.id}
