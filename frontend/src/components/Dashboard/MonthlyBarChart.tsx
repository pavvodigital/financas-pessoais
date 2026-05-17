import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { MonthlyTotal } from "../../types";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function MonthlyBarChart({ data }: { data: MonthlyTotal[] }) {
  const chartData = data.map((d) => ({
    name: MONTHS[d.month - 1],
    Gastos: d.total_expense,
    Renda: d.total_income,
  }));
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <h3 className="text-sm text-gray-400 mb-3">Histórico mensal</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} />
          <YAxis tick={{ fill: "#888", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Bar dataKey="Gastos" fill="#e05c5c" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Renda" fill="#4caf82" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
