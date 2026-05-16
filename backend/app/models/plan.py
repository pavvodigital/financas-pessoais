import uuid
from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, ForeignKey, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SavingsPlan(Base):
    __tablename__ = "savings_plans"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    goal_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    target_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    category_budgets: Mapped[list["PlanCategoryBudget"]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class PlanCategoryBudget(Base):
    __tablename__ = "plan_category_budgets"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    plan_id: Mapped[str] = mapped_column(ForeignKey("savings_plans.id"), nullable=False)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    monthly_limit: Mapped[float] = mapped_column(Numeric(10, 2))
    plan: Mapped["SavingsPlan"] = relationship(back_populates="category_budgets")
