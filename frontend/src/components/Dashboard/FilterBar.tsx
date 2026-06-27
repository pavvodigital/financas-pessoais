import { useFilterStore } from "../../store/filter";
import FilterPill from "../ui/FilterPill";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const SOURCE_OPTIONS: Array<{ value: "credit_card" | "bank" | null; label: string }> = [
  { value: null, label: "Todos" },
  { value: "credit_card", label: "Cartão" },
  { value: "bank", label: "Conta" },
];

interface Props {
  categories: Array<{ id: string; name: string }>;
}

export default function FilterBar({ categories }: Props) {
  const { month, year, categoryId, source, setMonth, setCategory, setSource } = useFilterStore();

  function prevMonth() {
    if (month === 1) setMonth(12, year - 1);
    else setMonth(month - 1, year);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) setMonth(1, year + 1);
    else setMonth(month + 1, year);
  }

  const activeCat = categories.find((c) => c.id === categoryId);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-3 bg-surface border border-hairline rounded-lg px-3 py-1.5">
        <button onClick={prevMonth} className="text-muted hover:text-ink text-lg leading-none">‹</button>
        <span className="text-sm font-medium min-w-[84px] text-center text-ink">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="text-muted hover:text-ink text-lg leading-none">›</button>
      </div>

      <div className="flex gap-2">
        {SOURCE_OPTIONS.map((opt) => (
          <FilterPill key={String(opt.value)} active={source === opt.value} onClick={() => setSource(opt.value)}>
            {opt.label}
          </FilterPill>
        ))}
      </div>

      {activeCat && (
        <div className="flex items-center gap-1 bg-accent-tint border border-accent rounded-full px-3 py-1 text-sm text-accent">
          <span>{activeCat.name}</span>
          <button onClick={() => setCategory(null)} className="ml-1 hover:text-ink leading-none">×</button>
        </div>
      )}
    </div>
  );
}
