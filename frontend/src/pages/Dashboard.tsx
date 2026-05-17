import { useEffect, useState } from "react";
import type { DashboardData } from "../types";
import api from "../api/client";
import { usePersonStore } from "../store/person";
import SummaryCards from "../components/Dashboard/SummaryCards";
import CategoryPieChart from "../components/Dashboard/CategoryPieChart";
import MonthlyBarChart from "../components/Dashboard/MonthlyBarChart";

export default function Dashboard() {
  const { person } = usePersonStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const now = new Date();
  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  useEffect(() => {
    api
      .get<DashboardData>(`/dashboard?month=${month}&year=${year}&person=${person}`)
      .then((r) => setData(r.data));
  }, [person, month, year]);

  if (!data) return <div className="text-gray-400">Carregando...</div>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">
        Dashboard — {month}/{year}
      </h1>
      <SummaryCards
        totalExpense={data.total_expense}
        totalIncome={data.total_income}
        balance={data.balance}
        vsLastMonth={data.vs_last_month_pct}
      />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <CategoryPieChart data={data.by_category} />
        <MonthlyBarChart data={data.monthly_history} />
      </div>
      <div className="bg-[#1a1a2e] rounded-xl p-4">
        <h3 className="text-sm text-gray-400 mb-3">Últimas transações</h3>
        <div className="space-y-2">
          {data.recent_transactions.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span className="text-gray-300">
                {t.date} · {t.description}
              </span>
              <span className={t.amount < 0 ? "text-red-400" : "text-green-400"}>
                R${" "}
                {Math.abs(t.amount).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
