import { useEffect, useState } from "react";
import api from "../api/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { usePersonStore } from "../store/person";
import Card from "../components/ui/Card";
import KpiStat from "../components/ui/KpiStat";
import SectionTitle from "../components/ui/SectionTitle";
import { chart, tooltipStyle, axisTick } from "../lib/chartTheme";
import { tableCls, theadCls, thCls, rowCls, tdCls } from "../components/ui/table";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Item {
  merchant_name: string; description: string;
  installment_current: number; installment_total: number;
  per_amount: number; remaining_count: number; remaining_amount: number;
  original_purchase_date: string | null; next_due_year: number; next_due_month: number;
}
interface Data {
  total_remaining: number; next_month_load: number; active_count: number;
  items: Item[];
  by_month: Array<{ year: number; month: number; amount: number; count: number }>;
}
interface Outlook {
  total_remaining: number;
  months: Array<{ year: number; month: number; is_future: boolean; realized: number | null; committed: number | null }>;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Installments() {
  const { person } = usePersonStore();
  const [data, setData] = useState<Data | null>(null);
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/installments?person=${person}`),
      api.get(`/installments/outlook?person=${person}`),
    ])
      .then(([d, o]) => { setData(d.data); setOutlook(o.data); })
      .finally(() => setLoading(false));
  }, [person]);

  if (loading) return <p className="text-muted">Carregando...</p>;
  if (!data || data.active_count === 0)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Parcelas</h1>
        <p className="text-muted">Nenhuma compra parcelada em aberto.</p>
      </div>
    );

  const timeline = (outlook?.months ?? []).map((m) => ({
    name: `${MONTHS[m.month - 1]}/${String(m.year).slice(2)}`,
    realizado: m.realized,
    aVencer: m.committed,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Parcelas — o que ainda falta pagar</h1>

      <Card className="!p-0">
        <div className="grid grid-cols-3 divide-x divide-hairline">
          <div className="p-5"><KpiStat label="Total a pagar em parcelas" value={`R$ ${brl(data.total_remaining)}`} accent /></div>
          <div className="p-5"><KpiStat label="Próximo mês" value={`R$ ${brl(data.next_month_load)}`} /></div>
          <div className="p-5"><KpiStat label="Compras parceladas ativas" value={String(data.active_count)} /></div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Gasto realizado × parcelas a vencer</SectionTitle>
        <p className="text-xs text-muted -mt-2 mb-3">Cinza = quanto saiu por mês (passado). Verde = parcelas de dívidas já existentes que ainda vão vencer.</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: chart.grid }} tickLine={false} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: chart.grid, opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => `R$ ${brl(Number(v))}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="realizado" name="Realizado" fill={chart.bar} radius={[3, 3, 0, 0]} />
            <Bar dataKey="aVencer" name="A vencer (parcelas)" fill={chart.accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionTitle>Detalhe por compra</SectionTitle>
        <div className="overflow-auto">
          <table className={tableCls}>
            <thead>
              <tr className={theadCls}>
                <th className={thCls}>Compra</th>
                <th className={thCls}>Parcela</th>
                <th className={`${thCls} text-right`}>Valor/parc</th>
                <th className={`${thCls} text-right`}>Faltam</th>
                <th className={`${thCls} text-right`}>A pagar</th>
                <th className={thCls}>Próx. venc.</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i} className={rowCls}>
                  <td className={tdCls}>{it.merchant_name}</td>
                  <td className={`${tdCls} text-muted`}>{it.installment_current}/{it.installment_total}</td>
                  <td className={`${tdCls} text-right text-ink`}>R$ {brl(it.per_amount)}</td>
                  <td className={`${tdCls} text-right text-muted`}>{it.remaining_count}x</td>
                  <td className={`${tdCls} text-right text-accent font-semibold`}>R$ {brl(it.remaining_amount)}</td>
                  <td className={`${tdCls} text-muted`}>{MONTHS[it.next_due_month - 1]}/{String(it.next_due_year).slice(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
