export interface Category {
  id: string; name: string; color: string; icon: string;
  monthly_budget: number | null; rule_count: number;
}
export interface Transaction {
  id: string; date: string; description: string; merchant_name: string | null;
  amount: number; type: string; person: string; source: string;
  category_id: string | null; category_name: string | null;
  category_color: string | null; manually_categorized: boolean;
}
export interface SavingsPlan {
  id: string; name: string; goal_amount: number;
  target_date: string; is_active: boolean;
}
export interface MonthlyTotal {
  year: number; month: number; total_expense: number; total_income: number;
}
export interface DashboardData {
  month: number; year: number; total_expense: number;
  total_income: number; balance: number; vs_last_month_pct: number | null;
  by_category: Array<{
    category_id: string; category_name: string; color: string;
    total: number; percentage: number;
  }>;
  monthly_history: MonthlyTotal[];
  recent_transactions: Transaction[];
}
