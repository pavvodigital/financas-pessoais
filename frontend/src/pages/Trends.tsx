import { useState } from "react";
import api from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { usePersonStore } from "../store/person";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface MerchantTrend {
  merchant: string;
  growth_pct: number | null;
  monthly: Array<{ year: number; month: number; total: number; count: number }>;
  recent_transactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    person: string;
  }>;
}

export default function Trends() {
  const { person } = usePersonStore();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<MerchantTrend | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const r = await api.get(
      `/trends/merchant?q=${encodeURIComponent(query)}&person=${person}`
    );
    setData(r.data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Tendências</h1>
      <div className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Buscar estabelecimento (ex: Uber, Supermercado...)"
          className="flex-1 bg-surface border border-hairline rounded-lg px-4 py-2 text-sm"
        />
        <button
          onClick={search}
          className="bg-accent text-white px-6 py-2 rounded-lg font-semibold"
        >
          Buscar
        </button>
      </div>
      {loading && <p className="text-muted">Buscando...</p>}
      {data && (
        <div className="space-y-4">
          <div className="bg-surface border border-hairline rounded-xl p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-lg">{data.merchant}</h2>
                {data.growth_pct != null && (
                  <p
                    className={`text-sm ${
                      data.growth_pct > 0 ? "text-danger" : "text-accent"
                    }`}
                  >
                    {data.growth_pct > 0 ? "↑" : "↓"}{" "}
                    {Math.abs(data.growth_pct)}% vs. primeiro mês
                  </p>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data.monthly.map((m) => ({
                  name: MONTHS[m.month - 1],
                  total: m.total,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ece9e3" />
                <XAxis dataKey="name" tick={{ fill: "#a8a29e", fontSize: 11 }} />
                <YAxis tick={{ fill: "#a8a29e", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid #ece9e3" }}
                  formatter={(v) =>
                    `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                />
                <Bar dataKey="total" fill="#047857" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-surface border border-hairline rounded-xl p-4">
            <h3 className="text-sm text-muted mb-3">Últimas transações</h3>
            <div className="space-y-2">
              {data.recent_transactions.map((t) => (
                <div key={t.id} className="flex justify-between text-sm">
                  <span className="text-ink">
                    {t.date} · {t.description} ·{" "}
                    <span className="text-muted capitalize">{t.person}</span>
                  </span>
                  <span className="text-danger">
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
      )}
    </div>
  );
}
