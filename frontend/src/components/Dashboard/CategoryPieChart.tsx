import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";
import SectionTitle from "../ui/SectionTitle";
import { tooltipStyle } from "../../lib/chartTheme";

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
    onCategoryClick(selectedCategoryId === entry.category_id ? null : entry.category_id);
  }

  return (
    <Card>
      <SectionTitle>Por categoria</SectionTitle>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category_name"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={2}
            style={{ cursor: "pointer" }}
            onClick={(entry) => handleClick(entry as unknown as CategoryItem)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.color}
                opacity={selectedCategoryId && selectedCategoryId !== entry.category_id ? 0.3 : 1}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 mt-2">
        {data.slice(0, 5).map((entry) => (
          <div
            key={entry.category_id}
            className="flex items-center justify-between text-xs cursor-pointer"
            onClick={() => handleClick(entry)}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: entry.color, opacity: selectedCategoryId && selectedCategoryId !== entry.category_id ? 0.3 : 1 }}
              />
              <span className={selectedCategoryId === entry.category_id ? "text-ink font-medium" : "text-muted"}>
                {entry.category_name}
              </span>
            </div>
            <span className="text-muted">{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
