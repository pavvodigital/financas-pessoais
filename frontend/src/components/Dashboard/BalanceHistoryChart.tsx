import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import Card from "../ui/Card";
import SectionTitle from "../ui/SectionTitle";
import { chart, tooltipStyle, axisTick } from "../../lib/chartTheme";

interface BalancePoint {
  year: number; month: number; income: number;
  expense: number; balance: number; cumulative: number;
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function BalanceHistoryChart({ data }: { data: BalancePoint[] }) {
  const chartData = data.map((d) => ({
    name: `${MONTHS[d.month - 1]}/${String(d.year).slice(2)}`,
    Acumulado: d.cumulative,
    Mensal: d.balance,
  }));

  return (
    <Card>
      <SectionTitle>Saldo acumulado — 12 meses</SectionTitle>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: chart.grid }} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke={chart.axis} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          />
          <Line type="monotone" dataKey="Acumulado" stroke={chart.accent} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="Mensal" stroke={chart.axis} strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
