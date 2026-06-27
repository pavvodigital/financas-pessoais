import { useEffect, useState } from "react";
import api from "../api/client";
import type { Transaction, Category } from "../types";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import Card from "../components/ui/Card";
import { tableCls, theadCls, rowCls } from "../components/ui/table";

function SourceBadge({ source }: { source: string }) {
  if (source === "credit_card")
    return <span className="text-xs px-2 py-0.5 rounded-full border border-hairline text-muted">Cartão</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint text-accent">Conta</span>;
}

export default function Transactions() {
  const { person } = usePersonStore();
  const { month, year, source, categoryId, query } = useFilterStore();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);
  useEffect(() => {
    setLoading(true);
    api.get(`/transactions?month=${month}&year=${year}&person=${person}&limit=500`)
      .then((r) => setTxs(r.data.items)).finally(() => setLoading(false));
  }, [person, month, year]);

  async function updateCategory(id: string, category_id: string) {
    await api.patch(`/transactions/${id}`, { category_id });
    setTxs((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const cat = categories.find((c) => c.id === category_id);
      return { ...t, category_id, category_name: cat?.name || null, category_color: cat?.color || null };
    }));
  }

  const q = query.trim().toLowerCase();
  const visible = txs
    .filter((tx) => !source || tx.source === source)
    .filter((tx) => !categoryId || tx.category_id === categoryId)
    .filter((tx) => !q || (tx.merchant_name || tx.description || "").toLowerCase().includes(q));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Transações</h1>
        <span className="text-sm text-muted">{visible.length} {visible.length === 1 ? "transação" : "transações"}</span>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-hairline/60 animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-ink font-medium">Nenhuma transação encontrada</p>
            <p className="text-muted text-sm mt-1">
              {q ? `Nada para "${query}". Tente outro termo ou limpe a busca.` : "Ajuste o período/filtros ou importe um extrato."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead>
                <tr className={theadCls}>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Pessoa</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tx) => (
                  <tr key={tx.id} className={rowCls}>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-2.5 text-ink">{tx.merchant_name || tx.description}</td>
                    <td className="px-4 py-2.5"><SourceBadge source={tx.source} /></td>
                    <td className="px-4 py-2.5 capitalize text-muted">{tx.person}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={tx.category_id || ""}
                        onChange={(e) => updateCategory(tx.id, e.target.value)}
                        aria-label="Categoria"
                        className="bg-paper border border-hairline rounded px-2 py-1 text-xs text-ink cursor-pointer outline-none focus:ring-2 focus:ring-accent/40"
                      >
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-medium whitespace-nowrap ${tx.amount < 0 ? "text-ink" : "text-accent"}`}>
                      {tx.amount < 0 ? "−" : "+"} R$ {Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
