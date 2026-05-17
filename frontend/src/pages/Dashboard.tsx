import { useEffect, useState } from "react";
import type { DashboardData, Category } from "../types";
import api from "../api/client";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import FilterBar from "../components/Dashboard/FilterBar";
import KpiCards from "../components/Dashboard/KpiCards";
import CategoryPieChart from "../components/Dashboard/CategoryPieChart";
import MonthlyBarChart from "../components/Dashboard/MonthlyBarChart";
import BalanceHistoryChart from "../components/Dashboard/BalanceHistoryChart";

interface BalancePoint {
  year: number;
  month: number;
  income: number;
  expense: number;
  balance: number;
  cumulative: number;
}

export default function Dashboard() {
  const { person } = usePersonStore();
  const { month, year, categoryId, source, setMonth, setCategory } = useFilterStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalancePoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ month: String(month), year: String(year), person });
    if (categoryId) params.set("category_id", categoryId);
    if (source) params.set("source", source);
    api.get<DashboardData>(`/dashboard?${params}`).then((r) => setData(r.data));
  }, [person, month, year, categoryId, source]);

  useEffect(() => {
    api
      .get<BalancePoint[]>(`/dashboard/balance-history?person=${person}`)
      .then((r) => setBalanceHistory(r.data));
  }, [person]);

  if (!data) return <div className="text-[#475569] p-6">Carregando...</div>;

  return (
    <div className="space-y-5">
      <FilterBar categories={categories} />
      <KpiCards
        totalExpense={data.total_expense}
        totalIncome={data.total_income}
        balance={data.balance}
        vsLastMonthPct={data.vs_last_month_pct}
      />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MonthlyBarChart
            data={data.monthly_history}
            selectedMonth={month}
            selectedYear={year}
            onMonthClick={setMonth}
          />
        </div>
        <CategoryPieChart
          data={data.by_category}
          selectedCategoryId={categoryId}
          onCategoryClick={setCategory}
        />
      </div>
      <BalanceHistoryChart data={balanceHistory} />
      <div className="bg-[#1e293b] rounded-xl p-4">
        <h3 className="text-sm text-[#94a3b8] mb-3">
          Últimas transações{categoryId ? " · filtrado por categoria" : ""}
        </h3>
        <div className="space-y-2">
          {data.recent_transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between text-sm py-1 border-b border-[#334155] last:border-0"
            >
              <span className="text-[#94a3b8]">
                {t.date} · {t.description}
              </span>
              <span className={t.amount < 0 ? "text-[#fb923c]" : "text-[#4ade80]"}>
                R$ {Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
