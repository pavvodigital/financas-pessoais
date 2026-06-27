interface Props {
  totalExpense: number;
  totalIncome: number;
  balance: number;
  vsLastMonth: number | null;
}

export default function SummaryCards({ totalExpense, totalIncome, balance, vsLastMonth }: Props) {
  const fmt = (n: number) =>
    `R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {[
        { label: "Gastos", value: fmt(totalExpense), color: "text-red-400" },
        { label: "Renda", value: fmt(totalIncome), color: "text-green-400" },
        {
          label: "Saldo",
          value: (balance >= 0 ? "" : "-") + fmt(balance),
          color: balance >= 0 ? "text-green-400" : "text-red-400",
        },
        {
          label: "vs. mês ant.",
          value:
            vsLastMonth != null
              ? `${vsLastMonth > 0 ? "+" : ""}${vsLastMonth}%`
              : "—",
          color:
            vsLastMonth != null && vsLastMonth > 0
              ? "text-red-400"
              : "text-green-400",
        },
      ].map((card) => (
        <div key={card.label} className="bg-paper rounded-xl p-4">
          <p className="text-muted text-xs mb-1">{card.label}</p>
          <p className={`font-bold text-lg ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
