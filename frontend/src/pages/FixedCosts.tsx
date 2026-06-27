import { useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { usePersonStore } from "../store/person";
import Card from "../components/ui/Card";
import KpiStat from "../components/ui/KpiStat";
import SectionTitle from "../components/ui/SectionTitle";
import { chart, tooltipStyle, axisTick } from "../lib/chartTheme";
import { tableCls, theadCls, thCls, rowCls, tdCls } from "../components/ui/table";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Fixed {
  id: string; label: string; match_key: string; person: string | null;
  expected_amount: number | null; avg_amount: number; representative: number;
  this_month: number; paid_this_month: boolean; months_seen: number;
}
interface Candidate { match_key: string; person: string; example: string; months_seen: number; avg_amount: number; }
interface Data {
  monthly_total: number; fixed: Fixed[]; candidates: Candidate[];
  by_month: Array<{ year: number; month: number; amount: number }>;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
      label, match_key: c.match_key, person: c.person,
      expected_amount: val ? Number(val.replace(",", ".")) : null,
    });
    load();
  }

  async function remove(id: string) {
    await api.delete(`/fixed-costs/${id}`);
    load();
  }

  if (loading) return <p className="text-muted">Carregando...</p>;
  if (!data) return null;

  const chartData = data.by_month.map((m) => ({ name: `${MONTHS[m.month - 1]}/${String(m.year).slice(2)}`, amount: m.amount }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Custos Fixos — gasto recorrente mensal</h1>

      <Card className="!p-0">
        <div className="grid grid-cols-2 divide-x divide-hairline">
          <div className="p-5"><KpiStat label="Total fixo por mês" value={`R$ ${brl(data.monthly_total)}`} accent /></div>
          <div className="p-5"><KpiStat label="Itens fixos" value={String(data.fixed.length)} /></div>
        </div>
      </Card>

      {data.by_month.length > 0 && (
        <Card>
          <SectionTitle>Custos fixos pagos por mês</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: chart.grid }} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: chart.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => `R$ ${brl(Number(v))}`} />
              <Bar dataKey="amount" fill={chart.accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <SectionTitle>Meus custos fixos</SectionTitle>
        {data.fixed.length === 0 ? (
          <p className="text-muted text-sm">Nada marcado ainda. Marque abaixo nas sugestões.</p>
        ) : (
          <table className={tableCls}>
            <thead>
              <tr className={theadCls}>
                <th className={thCls}>Conta</th>
                <th className={`${thCls} text-right`}>Valor/mês</th>
                <th className={`${thCls} text-center`}>Este mês</th>
                <th className={thCls}></th>
              </tr>
            </thead>
            <tbody>
              {data.fixed.map((f) => (
                <tr key={f.id} className={rowCls}>
                  <td className={tdCls}>
                    {f.label}
                    {f.person && <span className="text-muted text-xs ml-2 capitalize">{f.person}</span>}
                  </td>
                  <td className={`${tdCls} text-right text-accent font-semibold`}>R$ {brl(f.representative)}</td>
                  <td className={`${tdCls} text-center`}>
                    {f.paid_this_month
                      ? <span className="text-accent">✓ R$ {brl(f.this_month)}</span>
                      : <span className="text-danger">pendente</span>}
                  </td>
                  <td className={`${tdCls} text-right`}>
                    <button onClick={() => remove(f.id)} className="text-danger hover:opacity-70 text-xs">remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <SectionTitle>Sugestões (recorrentes — 3+ meses)</SectionTitle>
        <p className="text-xs text-muted -mt-2 mb-3">Marque o que é custo fixo de verdade.</p>
        {data.candidates.length === 0 ? (
          <p className="text-muted text-sm">Sem recorrentes novos.</p>
        ) : (
          <div>
            {data.candidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-hairline py-2 last:border-0">
                <div className="flex-1 truncate">
                  <span className="text-ink">{c.example}</span>
                  <span className="text-muted text-xs ml-2 capitalize">{c.person}</span>
                  <span className="text-muted text-xs ml-2">{c.months_seen} meses · ~R$ {brl(c.avg_amount)}/mês</span>
                </div>
                <button onClick={() => mark(c)} className="text-accent hover:opacity-70 text-xs ml-3 shrink-0 font-medium">+ marcar</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
