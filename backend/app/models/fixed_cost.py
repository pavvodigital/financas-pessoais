import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import String, DateTime, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class FixedCost(Base):
    """Um custo fixo/recorrente marcado pelo usuário (luz, água, internet...).

    `match_key` é a forma normalizada do comerciante/descrição; uma transação
    é considerada desse custo fixo quando sua normalização == match_key.
    """
    __tablename__ = "fixed_costs"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    match_key: Mapped[str] = mapped_column(String(120), nullable=False)
    person: Mapped[str | None] = mapped_column(String(20), nullable=True)
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
