import { useEffect, useState } from "react";
import api from "../api/client";
import type { Transaction, Category } from "../types";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function SourceBadge({ source }: { source: string }) {
  if (source === "credit_card")
    return <span className="text-xs px-1.5 py-0.5 rounded bg-[#1e3a5f] text-[#38bdf8]">Cartão</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded bg-[#1a2e1a] text-[#4ade80]">Conta</span>;
}

export default function Transactions() {
  const { person } = usePersonStore();
  const { categoryId: initialCategoryId, source: globalSource } = useFilterStore();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategoryId);
  const [selectedSource, setSelectedSource] = useState<string | null>(globalSource);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    api
      .get(`/transactions?month=${month}&year=${year}&person=${person}&limit=500`)
      .then((r) => setTxs(r.data.items));
  }, [person, month, year]);

  async function updateCategory(id: string, category_id: string) {
    await api.patch(`/transactions/${id}`, { category_id });
    setTxs((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const cat = categories.find((c) => c.id === category_id);
        return { ...t, category_id, category_name: cat?.name || null, category_color: cat?.color || null };
      })
    );
  }

  const visible = txs
    .filter((tx) => !selectedCategory || tx.category_id === selectedCategory)
    .filter((tx) => !selectedSource || tx.source === selectedSource);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold">Transações</h1>
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-[#1e293b] border border-[#334155] rounded px-3 py-1.5 text-sm"
        >
          {MONTHS.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          value={selectedCategory ?? ""}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="bg-[#1e293b] border border-[#334155] rounded px-3 py-1.5 text-sm"
        >
          <option value="">Todas categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden">
          {([null, "credit_card", "bank"] as const).map((s) => (
            <button
              key={String(s)}
              onClick={() => setSelectedSource(s)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedSource === s ? "bg-[#3b82f6] text-white" : "text-[#94a3b8] hover:text-white"
              }`}
            >
              {s === null ? "Todos" : s === "credit_card" ? "Cartão" : "Conta"}
            </button>
          ))}
        </div>
        <span className="text-sm text-[#64748b]">{visible.length} transações</span>
      </div>

      <div className="bg-[#1e293b] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left border-b border-[#334155]">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Pessoa</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((tx) => (
              <tr key={tx.id} className="border-b border-[#222] hover:bg-[#334155]">
                <td className="px-4 py-2 text-gray-400">{tx.date}</td>
                <td className="px-4 py-2">{tx.merchant_name || tx.description}</td>
                <td className="px-4 py-2"><SourceBadge source={tx.source} /></td>
                <td className="px-4 py-2 capitalize text-gray-400">{tx.person}</td>
                <td className="px-4 py-2">
                  <select
                    value={tx.category_id || ""}
                    onChange={(e) => updateCategory(tx.id, e.target.value)}
                    className="bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-xs"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    tx.amount < 0 ? "text-[#fb923c]" : "text-[#4ade80]"
                  }`}
                >
                  R$ {Math.abs(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="text-gray-500 text-center py-8">Nenhuma transação encontrada.</p>
        )}
      </div>
    </div>
  );
}
