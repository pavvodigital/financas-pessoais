import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

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
    <div className="bg-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm text-[#94a3b8] mb-3">Saldo acumulado — 12 meses</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Line
            type="monotone" dataKey="Acumulado"
            stroke="#38bdf8" strokeWidth={2} dot={false}
          />
          <Line
            type="monotone" dataKey="Mensal"
            stroke="#4ade80" strokeWidth={1.5} dot={false} strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
