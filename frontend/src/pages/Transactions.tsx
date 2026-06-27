import { useEffect, useState } from "react";
import api from "../api/client";
import type { Transaction, Category } from "../types";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import Card from "../components/ui/Card";
import FilterPill from "../components/ui/FilterPill";
import { tableCls, theadCls, rowCls } from "../components/ui/table";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function SourceBadge({ source }: { source: string }) {
  if (source === "credit_card")
    return <span className="text-xs px-2 py-0.5 rounded-full border border-hairline text-muted">Cartão</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint text-accent">Conta</span>;
}

const selectCls = "bg-surface border border-hairline rounded-lg px-3 py-1.5 text-sm text-ink";

export default function Transactions() {
  const { person } = usePersonStore();
  const { categoryId: initialCategoryId, source: globalSource } = useFilterStore();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategoryId);
  const [selectedSource, setSelectedSource] = useState<string | null>(globalSource);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);
  useEffect(() => {
    api.get(`/transactions?month=${month}&year=${year}&person=${person}&limit=500`).then((r) => setTxs(r.data.items));
  }, [person, month, year]);

  async function updateCategory(id: string, category_id: string) {
    await api.patch(`/transactions/${id}`, { category_id });
    setTxs((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const cat = categories.find((c) => c.id === category_id);
      return { ...t, category_id, category_name: cat?.name || null, category_color: cat?.color || null };
    }));
  }

  const visible = txs
    .filter((tx) => !selectedCategory || tx.category_id === selectedCategory)
    .filter((tx) => !selectedSource || tx.source === selectedSource);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Transações</h1>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectCls}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedCategory ?? ""} onChange={(e) => setSelectedCategory(e.target.value || null)} className={selectCls}>
          <option value="">Todas categorias</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          {([null, "credit_card", "bank"] as const).map((s) => (
            <FilterPill key={String(s)} active={selectedSource === s} onClick={() => setSelectedSource(s)}>
              {s === null ? "Todos" : s === "credit_card" ? "Cartão" : "Conta"}
            </FilterPill>
          ))}
        </div>
        <span className="text-sm text-muted">{visible.length} transações</span>
      </div>

      <Card className="!p-0 overflow-hidden">
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
                <td className="px-4 py-2.5 text-muted">{tx.date}</td>
                <td className="px-4 py-2.5 text-ink">{tx.merchant_name || tx.description}</td>
                <td className="px-4 py-2.5"><SourceBadge source={tx.source} /></td>
                <td className="px-4 py-2.5 capitalize text-muted">{tx.person}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={tx.category_id || ""}
                    onChange={(e) => updateCategory(tx.id, e.target.value)}
                    className="bg-paper border border-hairline rounded px-2 py-1 text-xs text-ink"
                  >
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${tx.amount < 0 ? "text-ink" : "text-accent"}`}>
                  {tx.amount < 0 ? "−" : "+"} R$ {Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="text-muted text-center py-8">Nenhuma transação encontrada.</p>}
      </Card>
    </div>
  );
}
