import Card from "../ui/Card";
import KpiStat from "../ui/KpiStat";

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
    <Card className="!p-0">
      <div className="grid grid-cols-3 divide-x divide-hairline">
        <div className="p-5">
          <KpiStat
            label="Gastos"
            value={fmt(totalExpense)}
            delta={vsLastMonthPct != null ? `${Math.abs(vsLastMonthPct)}% vs mês anterior` : undefined}
            deltaUp={vsLastMonthPct != null && vsLastMonthPct > 0}
          />
        </div>
        <div className="p-5">
          <KpiStat label="Renda" value={fmt(totalIncome)} />
        </div>
        <div className="p-5">
          <KpiStat label="Saldo" value={fmt(balance)} accent={balance >= 0} />
        </div>
      </div>
    </Card>
  );
}
