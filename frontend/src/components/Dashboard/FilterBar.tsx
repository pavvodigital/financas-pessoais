import { useFilterStore } from "../../store/filter";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Props {
  categories: Array<{ id: string; name: string }>;
}

export default function FilterBar({ categories }: Props) {
  const { month, year, categoryId, setMonth, setCategory } = useFilterStore();

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
      <div className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2">
        <button onClick={prevMonth} className="text-[#94a3b8] hover:text-white text-lg leading-none">‹</button>
        <span className="text-sm font-medium min-w-[80px] text-center text-[#f1f5f9]">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="text-[#94a3b8] hover:text-white text-lg leading-none">›</button>
      </div>
      {activeCat && (
        <div className="flex items-center gap-1 bg-[#1e3a5f] border border-[#38bdf8] rounded-full px-3 py-1 text-sm text-[#38bdf8]">
          <span>{activeCat.name}</span>
          <button
            onClick={() => setCategory(null)}
            className="ml-1 text-[#38bdf8] hover:text-white leading-none"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
