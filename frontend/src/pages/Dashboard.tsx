import { useEffect, useState } from "react";
import type { DashboardData } from "../types";
import api from "../api/client";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import KpiCards from "../components/Dashboard/KpiCards";
import CategoryPieChart from "../components/Dashboard/CategoryPieChart";
import MonthlyBarChart from "../components/Dashboard/MonthlyBarChart";
import BalanceHistoryChart from "../components/Dashboard/BalanceHistoryChart";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";

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

  if (!data) return <div className="text-muted p-6">Carregando...</div>;

  return (
    <div className="space-y-5">
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
      <Card>
        <SectionTitle>
          Últimas transações{categoryId ? " · filtrado por categoria" : ""}
        </SectionTitle>
        <div>
          {data.recent_transactions.map((t) => (
            <div
              key={t.id}
              className="flex justify-between text-sm py-2 border-b border-hairline last:border-0"
            >
              <span className="text-muted">
                {t.date} · <span className="text-ink">{t.description}</span>
              </span>
              <span className={t.amount < 0 ? "text-ink" : "text-accent"}>
                {t.amount < 0 ? "−" : "+"} R$ {Math.abs(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
