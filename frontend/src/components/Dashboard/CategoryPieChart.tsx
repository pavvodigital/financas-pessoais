import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface CategoryItem {
  category_id: string;
  category_name: string;
  total: number;
  color: string;
  percentage: number;
}

interface Props {
  data: CategoryItem[];
  selectedCategoryId?: string | null;
  onCategoryClick?: (id: string | null) => void;
}

export default function CategoryPieChart({ data, selectedCategoryId, onCategoryClick }: Props) {
  function handleClick(entry: CategoryItem) {
    if (!onCategoryClick) return;
    if (selectedCategoryId === entry.category_id) {
      onCategoryClick(null);
    } else {
      onCategoryClick(entry.category_id);
    }
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm text-[#94a3b8] mb-3">Por categoria</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category_name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            style={{ cursor: "pointer" }}
            onClick={(entry) => handleClick(entry as unknown as CategoryItem)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={
                  selectedCategoryId && selectedCategoryId !== entry.category_id ? 0.35 : 1
                }
                stroke={selectedCategoryId === entry.category_id ? "#f1f5f9" : "transparent"}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-2">
        {data.slice(0, 5).map((entry) => (
          <div
            key={entry.category_id}
            className="flex items-center justify-between text-xs cursor-pointer"
            onClick={() => handleClick(entry)}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: entry.color,
                  opacity: selectedCategoryId && selectedCategoryId !== entry.category_id ? 0.35 : 1,
                }}
              />
              <span className={
                selectedCategoryId === entry.category_id
                  ? "text-[#f1f5f9]"
                  : "text-[#94a3b8]"
              }>
                {entry.category_name}
              </span>
            </div>
            <span className="text-[#475569]">{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
