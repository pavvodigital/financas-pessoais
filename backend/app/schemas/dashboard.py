from pydantic import BaseModel
from typing import Optional

class CategoryTotal(BaseModel):
    category_id: str
    category_name: str
    color: str
    total: float
    percentage: float

class MonthlyTotal(BaseModel):
    year: int
    month: int
    total_expense: float
    total_income: float

class DashboardResponse(BaseModel):
    month: int
    year: int
    total_expense: float
    total_income: float
    balance: float
    vs_last_month_pct: Optional[float] = None
    by_category: list[CategoryTotal]
    monthly_history: list[MonthlyTotal]
    recent_transactions: list[dict]
