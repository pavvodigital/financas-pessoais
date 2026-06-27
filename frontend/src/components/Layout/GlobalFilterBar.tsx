import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api/client";
import { useFilterStore } from "../../store/filter";
import { usePersonStore } from "../../store/person";
import type { Category } from "../../types";
import FilterPill from "../ui/FilterPill";
import { Search, ChevronLeft, ChevronRight, X, Sliders } from "../ui/icons";

const TYPES = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
] as const;
const METHODS = [
  { value: "all", label: "Todos" },
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "debito", label: "Débito" },
  { value: "cartao", label: "Cartão" },
] as const;

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const SOURCES: Array<{ value: "credit_card" | "bank" | null; label: string }> = [
  { value: null, label: "Todos" },
  { value: "credit_card", label: "Cartão" },
  { value: "bank", label: "Conta" },
];
const PEOPLE = [
  { value: "ambos", label: "Ambos" },
  { value: "diogo", label: "Diogo" },
  { value: "lis", label: "Lis" },
] as const;

// Telas onde a barra não faz sentido
const HIDDEN = ["/import", "/categories", "/plans"];

export default function GlobalFilterBar() {
  const { pathname } = useLocation();
  const {
    month, year, source, categoryId, query, valueMin, valueMax, txType, method,
    setMonth, setSource, setCategory, setQuery, setValueMin, setValueMax, setTxType, setMethod, clearAdvanced,
  } = useFilterStore();
  const { person, setPerson } = usePersonStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);

  if (HIDDEN.some((h) => pathname.startsWith(h))) return null;

  const advCount = (valueMin ? 1 : 0) + (valueMax ? 1 : 0) + (txType !== "all" ? 1 : 0) + (method !== "all" ? 1 : 0);

  function prevMonth() { month === 1 ? setMonth(12, year - 1) : setMonth(month - 1, year); }
  function nextMonth() {
    const n = new Date();
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return;
    month === 12 ? setMonth(1, year + 1) : setMonth(month + 1, year);
  }
  const activeCat = categories.find((c) => c.id === categoryId);

  return (
    <div className="sticky top-0 z-20 -mx-8 -mt-8 mb-6 px-8 bg-paper/90 backdrop-blur border-b border-hairline">
     <div className="py-3 flex items-center gap-3 flex-wrap">
      {/* período */}
      <div className="flex items-center gap-1 bg-surface border border-hairline rounded-lg px-1.5 py-1">
        <button onClick={prevMonth} aria-label="Mês anterior" className="p-1 rounded text-muted hover:text-ink hover:bg-paper cursor-pointer transition-colors"><ChevronLeft /></button>
        <span className="text-sm font-medium min-w-[78px] text-center text-ink">{MONTHS[month - 1]} {year}</span>
        <button onClick={nextMonth} aria-label="Próximo mês" className="p-1 rounded text-muted hover:text-ink hover:bg-paper cursor-pointer transition-colors"><ChevronRight /></button>
      </div>

      {/* pessoa */}
      <div className="flex gap-1.5">
        {PEOPLE.map((p) => (
          <FilterPill key={p.value} active={person === p.value} onClick={() => setPerson(p.value)}>{p.label}</FilterPill>
        ))}
      </div>

      {/* origem */}
      <div className="flex gap-1.5">
        {SOURCES.map((s) => (
          <FilterPill key={String(s.value)} active={source === s.value} onClick={() => setSource(s.value)}>{s.label}</FilterPill>
        ))}
      </div>

      {/* busca */}
      <div className="relative ml-auto">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar loja/transação..."
          aria-label="Buscar"
          className="w-56 bg-surface border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
        />
      </div>

      {/* filtros avançados (toggle) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border border-hairline text-muted hover:text-ink hover:border-muted cursor-pointer transition-colors"
      >
        <Sliders /> Filtros
        {advCount > 0 && <span className="ml-0.5 bg-accent text-white rounded-full text-[10px] px-1.5 py-0.5 leading-none">{advCount}</span>}
      </button>

      {/* chip de categoria ativa */}
      {activeCat && (
        <button
          onClick={() => setCategory(null)}
          className="flex items-center gap-1 bg-accent-tint border border-accent rounded-full px-3 py-1 text-sm text-accent cursor-pointer hover:bg-accent hover:text-white transition-colors"
        >
          {activeCat.name} <X className="w-3 h-3" />
        </button>
      )}
     </div>

     {open && (
       <div className="pb-3 flex items-end gap-5 flex-wrap">
         <div>
           <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Valor (R$)</label>
           <div className="flex items-center gap-1.5">
             <input inputMode="decimal" value={valueMin} onChange={(e) => setValueMin(e.target.value)} placeholder="mín" aria-label="Valor mínimo" className="w-20 bg-surface border border-hairline rounded-lg px-2 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40" />
             <span className="text-muted">–</span>
             <input inputMode="decimal" value={valueMax} onChange={(e) => setValueMax(e.target.value)} placeholder="máx" aria-label="Valor máximo" className="w-20 bg-surface border border-hairline rounded-lg px-2 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40" />
           </div>
         </div>
         <div>
           <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Tipo</label>
           <div className="flex gap-1.5">
             {TYPES.map((t) => <FilterPill key={t.value} active={txType === t.value} onClick={() => setTxType(t.value)}>{t.label}</FilterPill>)}
           </div>
         </div>
         <div>
           <label className="block text-[11px] uppercase tracking-wider text-muted mb-1">Método</label>
           <div className="flex gap-1.5 flex-wrap">
             {METHODS.map((m) => <FilterPill key={m.value} active={method === m.value} onClick={() => setMethod(m.value)}>{m.label}</FilterPill>)}
           </div>
         </div>
         {advCount > 0 && (
           <button onClick={clearAdvanced} className="text-sm text-muted hover:text-ink cursor-pointer ml-auto">Limpar filtros</button>
         )}
       </div>
     )}
    </div>
  );
}
