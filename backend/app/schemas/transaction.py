from pydantic import BaseModel
from datetime import date
from typing import Optional


class TransactionPreview(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str] = None
    amount: float
    category_name: Optional[str] = None
    source: str
    raw_text: Optional[str] = None
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
    original_purchase_date: Optional[date] = None


class TransactionIn(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str] = None
    amount: float
    category_id: Optional[str] = None
    source: str
    raw_text: Optional[str] = None
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
    original_purchase_date: Optional[date] = None


class UploadPreviewResponse(BaseModel):
    file_id_temp: str
    transactions: list[TransactionPreview]
    duplicate_of: Optional[str] = None
    detected_person: Optional[str] = None


class UploadConfirmRequest(BaseModel):
    file_id_temp: str
    person: str  # diogo | lis
    filename: str
    file_type: str  # statement | credit_card
    transactions: list[TransactionIn]
