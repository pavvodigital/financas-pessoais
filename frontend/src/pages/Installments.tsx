import { useEffect, useState } from "react";
import api from "../api/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { usePersonStore } from "../store/person";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Item {
  merchant_name: string;
  description: string;
  installment_current: number;
  installment_total: number;
  per_amount: number;
  remaining_count: number;
  remaining_amount: number;
  original_purchase_date: string | null;
  next_due_year: number;
  next_due_month: number;
}
interface Data {
  total_remaining: number;
  next_month_load: number;
  active_count: number;
  items: Item[];
  by_month: Array<{ year: number; month: number; amount: number; count: number }>;
}
interface Outlook {
  total_remaining: number;
  months: Array<{
    year: number;
    month: number;
    is_future: boolean;
    realized: number | null;
    committed: number | null;
  }>;
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Card({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-4 flex-1">
      <p className="text-xs text-[#94a3b8] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

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
      .then(([d, o]) => {
        setData(d.data);
        setOutlook(o.data);
      })
      .finally(() => setLoading(false));
  }, [person]);

  if (loading) return <p className="text-gray-400">Carregando...</p>;
  if (!data || data.active_count === 0)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Parcelas</h1>
        <p className="text-gray-400">Nenhuma compra parcelada em aberto.</p>
      </div>
    );

  const timeline = (outlook?.months ?? []).map((m) => ({
    name: `${MONTHS[m.month - 1]}/${String(m.year).slice(2)}`,
    realizado: m.realized,
    aVencer: m.committed,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Parcelas — o que ainda falta pagar</h1>

      <div className="flex gap-4">
        <Card label="Total a pagar em parcelas" value={`R$ ${brl(data.total_remaining)}`} accent="text-[#fb923c]" />
        <Card label="Próximo mês" value={`R$ ${brl(data.next_month_load)}`} accent="text-[#f87171]" />
        <Card label="Compras parceladas ativas" value={String(data.active_count)} accent="text-[#38bdf8]" />
      </div>

      <div className="bg-[#1e293b] rounded-xl p-4">
        <h2 className="text-sm text-gray-400 mb-1">Gasto realizado × parcelas a vencer</h2>
        <p className="text-xs text-[#475569] mb-3">
          Cinza = quanto saiu por mês (passado). Laranja = parcelas de dívidas já existentes que ainda vão vencer.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 11 }} />
            <YAxis tick={{ fill: "#888", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
              formatter={(v) => `R$ ${brl(Number(v))}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="realizado" name="Realizado" fill="#64748b" radius={[3, 3, 0, 0]} />
            <Bar dataKey="aVencer" name="A vencer (parcelas)" fill="#fb923c" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#1e293b] rounded-xl p-4">
        <h2 className="text-sm text-gray-400 mb-3">Detalhe por compra</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left border-b border-[#334155]">
                <th className="py-2 pr-4">Compra</th>
                <th className="py-2 pr-4">Parcela</th>
                <th className="py-2 pr-4 text-right">Valor/parc</th>
                <th className="py-2 pr-4 text-right">Faltam</th>
                <th className="py-2 pr-4 text-right">A pagar</th>
                <th className="py-2">Próx. venc.</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i} className="border-b border-[#222] hover:bg-[#0f172a]">
                  <td className="py-2 pr-4">{it.merchant_name}</td>
                  <td className="py-2 pr-4 text-gray-400">
                    {it.installment_current}/{it.installment_total}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">R$ {brl(it.per_amount)}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{it.remaining_count}x</td>
                  <td className="py-2 pr-4 text-right text-[#fb923c] font-semibold">
                    R$ {brl(it.remaining_amount)}
                  </td>
                  <td className="py-2 text-gray-400">
                    {MONTHS[it.next_due_month - 1]}/{String(it.next_due_year).slice(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
