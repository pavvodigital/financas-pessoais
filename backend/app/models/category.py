import uuid
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#7c6af7")
    icon: Mapped[str] = mapped_column(String(50), default="❓")
    monthly_budget: Mapped[float | None] = mapped_column(nullable=True)
    rules: Mapped[list["CategoryRule"]] = relationship(back_populates="category", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")


class CategoryRule(Base):
    __tablename__ = "category_rules"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String(200), nullable=False)
    match_type: Mapped[str] = mapped_column(SAEnum("contains", "starts_with", "exact", name="match_type"), default="contains")
    priority: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped["Category"] = relationship(back_populates="rules")
