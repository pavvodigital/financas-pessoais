import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Props {
  data: Array<{ category_name: string; total: number; color: string; percentage: number }>;
}

export default function CategoryPieChart({ data }: Props) {
  return (
    <div className="bg-[#1a1a2e] rounded-xl p-4">
      <h3 className="text-sm text-gray-400 mb-3">Por categoria</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="category_name" cx="50%" cy="50%" outerRadius={80}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Legend
            formatter={(name) => (
              <span className="text-xs text-gray-300">{name}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
