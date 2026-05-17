import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { MonthlyTotal } from "../../types";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Props {
  data: MonthlyTotal[];
  selectedMonth?: number;
  selectedYear?: number;
  onMonthClick?: (month: number, year: number) => void;
}

export default function MonthlyBarChart({ data, selectedMonth, selectedYear, onMonthClick }: Props) {
  const chartData = data.map((d) => ({
    name: MONTHS[d.month - 1],
    month: d.month,
    year: d.year,
    Gastos: d.total_expense,
    Renda: d.total_income,
  }));

  function handleClick(payload: { month: number; year: number } | null) {
    if (payload && onMonthClick) onMonthClick(payload.month, payload.year);
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm text-[#94a3b8] mb-3">Histórico mensal</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} style={{ cursor: onMonthClick ? "pointer" : "default" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Bar
            dataKey="Gastos"
            radius={[3, 3, 0, 0]}
            onClick={(d) => handleClick(d as { month: number; year: number })}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#f97316"
                    : "#fb923c99"
                }
                stroke={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#fed7aa"
                    : "transparent"
                }
                strokeWidth={2}
              />
            ))}
          </Bar>
          <Bar
            dataKey="Renda"
            radius={[3, 3, 0, 0]}
            onClick={(d) => handleClick(d as { month: number; year: number })}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#22c55e"
                    : "#4ade8099"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
