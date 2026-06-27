import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { MonthlyTotal } from "../../types";
import Card from "../ui/Card";
import SectionTitle from "../ui/SectionTitle";
import { chart, tooltipStyle, axisTick } from "../../lib/chartTheme";

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
    <Card>
      <SectionTitle>Fluxo mensal</SectionTitle>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} style={{ cursor: onMonthClick ? "pointer" : "default" }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: chart.grid }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: chart.grid, opacity: 0.4 }}
            contentStyle={tooltipStyle}
            formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          />
          <Bar dataKey="Gastos" radius={[3, 3, 0, 0]} onClick={(d) => handleClick(d as unknown as { month: number; year: number })}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.month === selectedMonth && entry.year === selectedYear ? chart.barActive : chart.bar} />
            ))}
          </Bar>
          <Bar dataKey="Renda" radius={[3, 3, 0, 0]} onClick={(d) => handleClick(d as unknown as { month: number; year: number })}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.month === selectedMonth && entry.year === selectedYear ? "#34d399" : "#d1d5db"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
