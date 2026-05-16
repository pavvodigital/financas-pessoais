import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import String, Date, DateTime, ForeignKey, Boolean, Enum as SAEnum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(SAEnum("statement", "credit_card", name="file_type"))
    person: Mapped[str] = mapped_column(SAEnum("diogo", "lis", name="person_type"))
    month: Mapped[int] = mapped_column()
    year: Mapped[int] = mapped_column()
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    transaction_count: Mapped[int] = mapped_column(default=0)
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="file")


class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[str] = mapped_column(SAEnum("expense", "income", "transfer", "investment", name="tx_type"))
    category_id: Mapped[str | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    person: Mapped[str] = mapped_column(SAEnum("diogo", "lis", "joint", name="person_tx"))
    source: Mapped[str] = mapped_column(SAEnum("bank", "credit_card", "manual", name="tx_source"))
    file_id: Mapped[str | None] = mapped_column(ForeignKey("uploaded_files.id"), nullable=True)
    merchant_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    raw_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    manually_categorized: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped["Category | None"] = relationship(back_populates="transactions")
    file: Mapped["UploadedFile | None"] = relationship(back_populates="transactions")
