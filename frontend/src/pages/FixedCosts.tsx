import { useEffect, useState, useCallback } from "react";
import api from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { usePersonStore } from "../store/person";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Fixed {
  id: string; label: string; match_key: string; person: string | null;
  expected_amount: number | null; avg_amount: number; representative: number;
  this_month: number; paid_this_month: boolean; months_seen: number;
}
interface Candidate {
  match_key: string; person: string; example: string; months_seen: number; avg_amount: number;
}
interface Data {
  monthly_total: number;
  fixed: Fixed[];
  candidates: Candidate[];
  by_month: Array<{ year: number; month: number; amount: number }>;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FixedCosts() {
  const { person } = usePersonStore();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/fixed-costs?person=${person}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [person]);

  useEffect(() => { load(); }, [load]);

  async function mark(c: Candidate) {
    const label = window.prompt("Nome do custo fixo (ex: Luz, Água, Internet):", c.example);
    if (!label) return;
    const val = window.prompt(`Valor esperado por mês (opcional, média atual R$ ${brl(c.avg_amount)}):`, "");
    await api.post("/fixed-costs", {
      label,
      match_key: c.match_key,
      person: c.person,
      expected_amount: val ? Number(val.replace(",", ".")) : null,
    });
    load();
  }

  async function remove(id: string) {
    await api.delete(`/fixed-costs/${id}`);
    load();
  }

  if (loading) return <p className="text-gray-400">Carregando...</p>;
  if (!data) return null;

  const chart = data.by_month.map((m) => ({ name: `${MONTHS[m.month - 1]}/${String(m.year).slice(2)}`, amount: m.amount }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Custos Fixos — gasto recorrente mensal</h1>

      <div className="flex gap-4">
        <div className="bg-[#1e293b] rounded-xl p-4 flex-1">
          <p className="text-xs text-[#94a3b8] mb-1">Total fixo por mês</p>
          <p className="text-2xl font-bold text-[#38bdf8]">R$ {brl(data.monthly_total)}</p>
        </div>
        <div className="bg-[#1e293b] rounded-xl p-4 flex-1">
          <p className="text-xs text-[#94a3b8] mb-1">Itens fixos</p>
          <p className="text-2xl font-bold text-[#f1f5f9]">{data.fixed.length}</p>
        </div>
      </div>

      {data.by_month.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl p-4">
          <h2 className="text-sm text-gray-400 mb-3">Custos fixos pagos por mês</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} />
              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                formatter={(v) => `R$ ${brl(Number(v))}`} />
              <Bar dataKey="amount" fill="#38bdf8" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-[#1e293b] rounded-xl p-4">
        <h2 className="text-sm text-gray-400 mb-3">Meus custos fixos</h2>
        {data.fixed.length === 0 ? (
          <p className="text-gray-500 text-sm">Nada marcado ainda. Marque abaixo nas sugestões.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-[#334155]">
                <th className="py-2 pr-4">Conta</th>
                <th className="py-2 pr-4 text-right">Valor/mês</th>
                <th className="py-2 pr-4 text-center">Este mês</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.fixed.map((f) => (
                <tr key={f.id} className="border-b border-[#222]">
                  <td className="py-2 pr-4">
                    {f.label}
                    {f.person && <span className="text-gray-500 text-xs ml-2 capitalize">{f.person}</span>}
                  </td>
                  <td className="py-2 pr-4 text-right text-[#38bdf8] font-semibold">R$ {brl(f.representative)}</td>
                  <td className="py-2 pr-4 text-center">
                    {f.paid_this_month
                      ? <span className="text-[#4ade80]">✓ R$ {brl(f.this_month)}</span>
                      : <span className="text-[#fb923c]">pendente</span>}
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => remove(f.id)} className="text-[#fb923c] hover:text-orange-300 text-xs">remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-[#1e293b] rounded-xl p-4">
        <h2 className="text-sm text-gray-400 mb-1">Sugestões (recorrentes — 3+ meses)</h2>
        <p className="text-xs text-[#475569] mb-3">Marque o que é custo fixo de verdade.</p>
        {data.candidates.length === 0 ? (
          <p className="text-gray-500 text-sm">Sem recorrentes novos.</p>
        ) : (
          <div className="space-y-1">
            {data.candidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-[#222] py-1.5">
                <div className="flex-1 truncate">
                  <span className="text-gray-200">{c.example}</span>
                  <span className="text-gray-500 text-xs ml-2 capitalize">{c.person}</span>
                  <span className="text-gray-600 text-xs ml-2">{c.months_seen} meses · ~R$ {brl(c.avg_amount)}/mês</span>
                </div>
                <button onClick={() => mark(c)} className="text-[#38bdf8] hover:text-white text-xs ml-3 shrink-0">+ marcar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
