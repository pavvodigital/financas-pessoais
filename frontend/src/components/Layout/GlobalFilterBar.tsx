import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../api/client";
import { useFilterStore } from "../../store/filter";
import { usePersonStore } from "../../store/person";
import type { Category } from "../../types";
import FilterPill from "../ui/FilterPill";
import { Search, ChevronLeft, ChevronRight, X } from "../ui/icons";

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
  const { month, year, source, categoryId, query, setMonth, setSource, setCategory, setQuery } = useFilterStore();
  const { person, setPerson } = usePersonStore();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => { api.get<Category[]>("/categories").then((r) => setCategories(r.data)); }, []);

  if (HIDDEN.some((h) => pathname.startsWith(h))) return null;

  function prevMonth() { month === 1 ? setMonth(12, year - 1) : setMonth(month - 1, year); }
  function nextMonth() {
    const n = new Date();
    if (year > n.getFullYear() || (year === n.getFullYear() && month >= n.getMonth() + 1)) return;
    month === 12 ? setMonth(1, year + 1) : setMonth(month + 1, year);
  }
  const activeCat = categories.find((c) => c.id === categoryId);

  return (
    <div className="sticky top-0 z-20 -mx-8 -mt-8 mb-6 px-8 py-3 bg-paper/90 backdrop-blur border-b border-hairline flex items-center gap-3 flex-wrap">
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
  );
}
