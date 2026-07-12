import { useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { usePersonStore } from "../store/person";
import Card from "../components/ui/Card";
import KpiStat from "../components/ui/KpiStat";
import SectionTitle from "../components/ui/SectionTitle";
import { useToast } from "../components/ui/toast";
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
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<number | null>(null);
  const [form, setForm] = useState({ label: "", expected: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/fixed-costs?person=${person}`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [person]);

  useEffect(() => { load(); }, [load]);

  function openMark(idx: number, c: Candidate) {
    setMarking(idx);
    setForm({ label: c.example, expected: "" });
  }

  async function confirmMark(c: Candidate) {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      await api.post("/fixed-costs", {
        label: form.label.trim(), match_key: c.match_key, person: c.person,
        expected_amount: form.expected ? Number(form.expected.replace(",", ".")) : null,
      });
      toast("success", `"${form.label.trim()}" marcado como custo fixo`);
      setMarking(null);
      load();
    } catch {
      toast("error", "Erro ao salvar custo fixo");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    try {
      await api.delete(`/fixed-costs/${id}`);
      toast("success", `"${label}" removido`);
      load();
    } catch {
      toast("error", "Erro ao remover");
    }
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
                    <button onClick={() => remove(f.id, f.label)} className="text-danger hover:opacity-70 text-xs cursor-pointer">remover</button>
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
              <div key={i} className="border-b border-hairline last:border-0">
                <div className="flex items-center justify-between text-sm py-2">
                  <div className="flex-1 truncate">
                    <span className="text-ink">{c.example}</span>
                    <span className="text-muted text-xs ml-2 capitalize">{c.person}</span>
                    <span className="text-muted text-xs ml-2">{c.months_seen} meses · ~R$ {brl(c.avg_amount)}/mês</span>
                  </div>
                  {marking === i ? (
                    <button onClick={() => setMarking(null)} className="text-muted hover:text-ink text-xs ml-3 shrink-0 cursor-pointer">cancelar</button>
                  ) : (
                    <button onClick={() => openMark(i, c)} className="text-accent hover:opacity-70 text-xs ml-3 shrink-0 font-medium cursor-pointer">+ marcar</button>
                  )}
                </div>
                {marking === i && (
                  <div className="flex items-end gap-3 pb-3 flex-wrap">
                    <div>
                      <label htmlFor={`fc-label-${i}`} className="block text-[11px] uppercase tracking-wider text-muted mb-1">Nome</label>
                      <input
                        id={`fc-label-${i}`}
                        value={form.label}
                        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                        placeholder="Luz, Água, Internet..."
                        className="w-56 bg-paper border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor={`fc-exp-${i}`} className="block text-[11px] uppercase tracking-wider text-muted mb-1">Valor/mês (opcional)</label>
                      <input
                        id={`fc-exp-${i}`}
                        inputMode="decimal"
                        value={form.expected}
                        onChange={(e) => setForm((f) => ({ ...f, expected: e.target.value }))}
                        placeholder={`média ${brl(c.avg_amount)}`}
                        className="w-36 bg-paper border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                    <button
                      onClick={() => confirmMark(c)}
                      disabled={saving || !form.label.trim()}
                      className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
