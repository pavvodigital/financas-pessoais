import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import type { Transaction, Category } from "../types";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import Card from "../components/ui/Card";
import { useToast } from "../components/ui/toast";
import { Download } from "../components/ui/icons";
import { tableCls, theadCls, rowCls } from "../components/ui/table";

function SourceBadge({ source }: { source: string }) {
  if (source === "credit_card")
    return <span className="text-xs px-2 py-0.5 rounded-full border border-hairline text-muted">Cartão</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint text-accent">Conta</span>;
}

function detectMethod(tx: Transaction): string {
  if (tx.source === "credit_card") return "cartao";
  const d = (tx.description || "").toUpperCase().trim();
  if (d.startsWith("PIX")) return "pix";
  if (d.includes("BOLETO")) return "boleto";
  if (d.startsWith("DA ") || d.includes("DEBITO AUT")) return "debito";
  return "outros";
}

type SortKey = "date" | "description" | "amount";

export default function Transactions() {
  const { person } = usePersonStore();
  const { month, year, source, categoryId, query, valueMin, valueMax, txType, method } = useFilterStore();
  const toast = useToast();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [bulkPerson, setBulkPerson] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);
  useEffect(() => {
    setLoading(true);
    setSelected(new Set());
    api.get(`/transactions?month=${month}&year=${year}&person=${person}&limit=500`)
      .then((r) => setTxs(r.data.items)).finally(() => setLoading(false));
  }, [person, month, year]);

  async function updateCategory(id: string, category_id: string) {
    try {
      await api.patch(`/transactions/${id}`, { category_id });
      const cat = categories.find((c) => c.id === category_id);
      setTxs((prev) => prev.map((t) =>
        t.id === id ? { ...t, category_id, category_name: cat?.name || null, category_color: cat?.color || null } : t
      ));
      toast("success", "Categoria atualizada");
    } catch {
      toast("error", "Erro ao salvar categoria");
    }
  }

  const q = query.trim().toLowerCase();
  const min = valueMin ? parseFloat(valueMin.replace(",", ".")) : null;
  const max = valueMax ? parseFloat(valueMax.replace(",", ".")) : null;

  const visible = useMemo(() => {
    const filtered = txs
      .filter((tx) => !source || tx.source === source)
      .filter((tx) => !categoryId || tx.category_id === categoryId)
      .filter((tx) => !q || (tx.merchant_name || tx.description || "").toLowerCase().includes(q))
      .filter((tx) => txType === "all" || (txType === "expense" ? tx.amount < 0 : tx.amount > 0))
      .filter((tx) => method === "all" || detectMethod(tx) === method)
      .filter((tx) => min == null || Math.abs(tx.amount) >= min)
      .filter((tx) => max == null || Math.abs(tx.amount) <= max);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "amount") return (Math.abs(a.amount) - Math.abs(b.amount)) * dir;
      if (sortKey === "description")
        return (a.merchant_name || a.description).localeCompare(b.merchant_name || b.description) * dir;
      return a.date.localeCompare(b.date) * dir;
    });
  }, [txs, source, categoryId, q, txType, method, min, max, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "description" ? "asc" : "desc"); }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));
  function toggleAll() {
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((t) => t.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    if (!bulkCat && !bulkPerson) return;
    setApplying(true);
    const body: Record<string, string> = {};
    if (bulkCat) body.category_id = bulkCat;
    if (bulkPerson) body.person = bulkPerson;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await api.patch(`/transactions/${id}`, body); ok++; } catch { fail++; }
    }
    const cat = categories.find((c) => c.id === bulkCat);
    setTxs((prev) => prev.map((t) => {
      if (!selected.has(t.id)) return t;
      return {
        ...t,
        ...(bulkCat ? { category_id: bulkCat, category_name: cat?.name || null, category_color: cat?.color || null } : {}),
        ...(bulkPerson ? { person: bulkPerson } : {}),
      };
    }));
    setApplying(false);
    setSelected(new Set());
    setBulkCat(""); setBulkPerson("");
    if (fail) toast("error", `${ok} atualizadas, ${fail} falharam`);
    else toast("success", `${ok} transações atualizadas`);
  }

  function exportCsv() {
    const rows = selected.size > 0 ? visible.filter((t) => selected.has(t.id)) : visible;
    const esc = (s: string) => `"${(s || "").replace(/"/g, '""')}"`;
    const lines = [
      "data;descricao;origem;pessoa;categoria;valor",
      ...rows.map((t) =>
        [t.date, esc(t.merchant_name || t.description), t.source === "credit_card" ? "cartao" : t.source,
         t.person, esc(t.category_name || ""), String(t.amount).replace(".", ",")].join(";")
      ),
    ];
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transacoes_${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("success", `${rows.length} transações exportadas`);
  }

  const selectCls = "bg-paper border border-hairline rounded-lg px-2 py-1.5 text-sm text-ink cursor-pointer outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Transações</h1>
        <span className="text-sm text-muted">{visible.length} {visible.length === 1 ? "transação" : "transações"}</span>
        <button
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-hairline text-muted hover:text-ink hover:border-muted cursor-pointer transition-colors disabled:opacity-40"
        >
          <Download /> CSV{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-accent-tint border border-accent/40 rounded-lg px-4 py-2.5">
          <span className="text-sm text-ink font-medium">{selected.size} selecionadas</span>
          <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} aria-label="Categoria em massa" className={selectCls}>
            <option value="">Categoria...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={bulkPerson} onChange={(e) => setBulkPerson(e.target.value)} aria-label="Pessoa em massa" className={selectCls}>
            <option value="">Pessoa...</option>
            <option value="diogo">Diogo</option>
            <option value="lis">Lis</option>
            <option value="joint">Conjunta</option>
          </select>
          <button
            onClick={applyBulk}
            disabled={applying || (!bulkCat && !bulkPerson)}
            className="bg-accent text-white rounded-lg px-4 py-1.5 text-sm font-medium cursor-pointer hover:opacity-90 disabled:opacity-50"
          >
            {applying ? "Aplicando..." : "Aplicar"}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-muted hover:text-ink cursor-pointer">Limpar</button>
        </div>
      )}

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
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Selecionar todas" className="cursor-pointer accent-[#047857]" />
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("date")}>Data{arrow("date")}</th>
                  <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("description")}>Descrição{arrow("description")}</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Pessoa</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("amount")}>Valor{arrow("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((tx) => (
                  <tr key={tx.id} className={`${rowCls} ${selected.has(tx.id) ? "bg-accent-tint/60" : ""}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleOne(tx.id)} aria-label="Selecionar" className="cursor-pointer accent-[#047857]" />
                    </td>
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
