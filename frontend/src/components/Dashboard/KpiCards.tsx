interface Props {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  vsLastMonthPct: number | null;
}

function fmt(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function KpiCards({ totalExpense, totalIncome, balance, vsLastMonthPct }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-[#1e293b] rounded-xl p-4 border-l-4 border-[#fb923c]">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wide mb-1">Gastos</p>
        <p className="text-xl font-bold text-[#fb923c]">{fmt(totalExpense)}</p>
        {vsLastMonthPct != null && (
          <p className={`text-xs mt-1 ${vsLastMonthPct > 0 ? "text-[#fb923c]" : "text-[#4ade80]"}`}>
            {vsLastMonthPct > 0 ? "▲" : "▼"} {Math.abs(vsLastMonthPct)}% vs mês anterior
          </p>
        )}
      </div>
      <div className="bg-[#1e293b] rounded-xl p-4 border-l-4 border-[#4ade80]">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wide mb-1">Renda</p>
        <p className="text-xl font-bold text-[#4ade80]">{fmt(totalIncome)}</p>
      </div>
      <div className="bg-[#1e293b] rounded-xl p-4 border-l-4 border-[#38bdf8]">
        <p className="text-[#94a3b8] text-xs uppercase tracking-wide mb-1">Saldo</p>
        <p className={`text-xl font-bold ${balance >= 0 ? "text-[#38bdf8]" : "text-[#fb923c]"}`}>
          {fmt(balance)}
        </p>
      </div>
    </div>
  );
}
