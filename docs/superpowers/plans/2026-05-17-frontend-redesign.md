# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend with Slate Modern dark theme, Power BI-style cross-filtering dashboard (click chart → filters other charts + transactions), balance history line chart, and global visual polish.

**Architecture:** A new Zustand `useFilterStore` holds the active month/year/categoryId. Dashboard components read from and write to this store on click. The existing `/api/dashboard` endpoint gets an optional `category_id` filter for recent_transactions. A new `/api/dashboard/balance-history` endpoint provides 12-month cumulative data for the line chart.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS v4, Recharts, Zustand, FastAPI, SQLAlchemy

---

## File Map

**New files:**
- `frontend/src/store/filter.ts` — month/year/categoryId filter store
- `frontend/src/components/Dashboard/FilterBar.tsx` — month nav arrows + active category pill
- `frontend/src/components/Dashboard/KpiCards.tsx` — 3 KPI cards with trend indicator
- `frontend/src/components/Dashboard/BalanceHistoryChart.tsx` — line chart 12 months

**Modified files:**
- `backend/app/routers/dashboard.py` — add `/balance-history` route, add `category_id` filter to recent_transactions
- `frontend/src/pages/Dashboard.tsx` — new layout consuming filter store
- `frontend/src/components/Dashboard/CategoryPieChart.tsx` — add `onCategoryClick` + `selectedCategoryId`
- `frontend/src/components/Dashboard/MonthlyBarChart.tsx` — add `onMonthClick` + `selectedMonth`/`selectedYear`
- `frontend/src/components/Layout/Sidebar.tsx` — Slate Modern colors
- `frontend/src/pages/Transactions.tsx` — read initial categoryId from filter store
- `frontend/src/pages/Categories.tsx` — Slate Modern colors
- `frontend/src/pages/Plans.tsx` — Slate Modern colors
- `frontend/src/pages/Trends.tsx` — Slate Modern colors
- `frontend/src/pages/Import.tsx` — Slate Modern colors
- `frontend/src/pages/Login.tsx` — Slate Modern colors

---

### Task 1: Backend — balance-history endpoint + category_id filter

**Files:**
- Modify: `backend/app/routers/dashboard.py`

- [ ] **Step 1: Add `category_id` param to existing dashboard endpoint and filter `recent_transactions`**

In `backend/app/routers/dashboard.py`, add `category_id: str = Query(default=None)` to `get_dashboard` signature and filter the recent list:

```python
@router.get("", response_model=DashboardResponse)
def get_dashboard(
    month: int = Query(default=None),
    year: int = Query(default=None),
    person: str = Query(default=None),
    category_id: str = Query(default=None),
    db: Session = Depends(get_db),
):
    # ... existing code unchanged for totals/by_category/history ...
    
    recent_q = sorted(txs, key=lambda x: x.date, reverse=True)
    if category_id:
        recent_q = [t for t in recent_q if t.category_id == category_id]
    recent = [{
        "id": t.id, "date": str(t.date), "description": t.description,
        "merchant_name": t.merchant_name,
        "amount": float(t.amount), "person": t.person,
        "category_id": t.category_id,
    } for t in recent_q[:20]]
```

- [ ] **Step 2: Add `/balance-history` route at the end of `dashboard.py`**

```python
@router.get("/balance-history")
def balance_history(person: str = Query(default="ambos"), db: Session = Depends(get_db)):
    from datetime import date as date_type
    today = date_type.today()
    months = []
    for i in range(11, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        months.append((y, m))

    cumulative = 0.0
    result = []
    for y, m in months:
        q = db.query(Transaction).filter(
            func.extract("month", Transaction.date) == m,
            func.extract("year", Transaction.date) == y,
        )
        if person != "ambos":
            q = q.filter(Transaction.person == person)
        txs = q.all()
        income = round(sum(float(t.amount) for t in txs if t.amount > 0), 2)
        expense = round(abs(sum(float(t.amount) for t in txs if t.amount < 0)), 2)
        balance = round(income - expense, 2)
        cumulative = round(cumulative + balance, 2)
        result.append({"year": y, "month": m, "income": income,
                        "expense": expense, "balance": balance, "cumulative": cumulative})
    return result
```

- [ ] **Step 3: Test both endpoints manually**

```bash
# From backend dir with uvicorn running or via test
cd backend
python -m pytest tests/ -v -k "dashboard" 2>&1 | tail -20
```

Expected: existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/dashboard.py
git commit -m "feat: balance-history endpoint + category_id filter for recent transactions"
```

---

### Task 2: Filter store

**Files:**
- Create: `frontend/src/store/filter.ts`

- [ ] **Step 1: Create the filter store**

```typescript
// frontend/src/store/filter.ts
import { create } from "zustand";

interface FilterState {
  month: number;
  year: number;
  categoryId: string | null;
  setMonth: (month: number, year: number) => void;
  setCategory: (id: string | null) => void;
  clear: () => void;
}

const now = new Date();

export const useFilterStore = create<FilterState>((set) => ({
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  categoryId: null,
  setMonth: (month, year) => set({ month, year }),
  setCategory: (categoryId) => set({ categoryId }),
  clear: () => set({ categoryId: null }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/store/filter.ts
git commit -m "feat: filter store for dashboard cross-filtering"
```

---

### Task 3: FilterBar component

**Files:**
- Create: `frontend/src/components/Dashboard/FilterBar.tsx`

- [ ] **Step 1: Create FilterBar**

```tsx
// frontend/src/components/Dashboard/FilterBar.tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/FilterBar.tsx
git commit -m "feat: FilterBar component with month nav and active category pill"
```

---

### Task 4: KpiCards component

**Files:**
- Create: `frontend/src/components/Dashboard/KpiCards.tsx`

- [ ] **Step 1: Create KpiCards**

```tsx
// frontend/src/components/Dashboard/KpiCards.tsx
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/KpiCards.tsx
git commit -m "feat: KpiCards component with trend indicator"
```

---

### Task 5: MonthlyBarChart — clickable bars

**Files:**
- Modify: `frontend/src/components/Dashboard/MonthlyBarChart.tsx`

- [ ] **Step 1: Rewrite MonthlyBarChart with click support**

```tsx
// frontend/src/components/Dashboard/MonthlyBarChart.tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import type { MonthlyTotal } from "../../types";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

interface Props {
  data: MonthlyTotal[];
  selectedMonth?: number;
  selectedYear?: number;
  onMonthClick?: (month: number, year: number) => void;
}

export default function MonthlyBarChart({ data, selectedMonth, selectedYear, onMonthClick }: Props) {
  const chartData = data.map((d) => ({
    name: MONTHS[d.month - 1],
    month: d.month,
    year: d.year,
    Gastos: d.total_expense,
    Renda: d.total_income,
  }));

  function handleClick(payload: { month: number; year: number } | null) {
    if (payload && onMonthClick) onMonthClick(payload.month, payload.year);
  }

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm text-[#94a3b8] mb-3">Histórico mensal</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} style={{ cursor: onMonthClick ? "pointer" : "default" }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Bar
            dataKey="Gastos"
            radius={[3, 3, 0, 0]}
            onClick={(d) => handleClick(d as { month: number; year: number })}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#f97316"
                    : "#fb923c99"
                }
                stroke={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#fed7aa"
                    : "transparent"
                }
                strokeWidth={2}
              />
            ))}
          </Bar>
          <Bar
            dataKey="Renda"
            radius={[3, 3, 0, 0]}
            onClick={(d) => handleClick(d as { month: number; year: number })}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.month === selectedMonth && entry.year === selectedYear
                    ? "#22c55e"
                    : "#4ade8099"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/MonthlyBarChart.tsx
git commit -m "feat: MonthlyBarChart clickable bars with selection highlight"
```

---

### Task 6: CategoryPieChart — clickable slices

**Files:**
- Modify: `frontend/src/components/Dashboard/CategoryPieChart.tsx`

- [ ] **Step 1: Rewrite CategoryPieChart with click support**

```tsx
// frontend/src/components/Dashboard/CategoryPieChart.tsx
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
      onCategoryClick(null); // deselect on second click
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
            onClick={(entry: CategoryItem) => handleClick(entry)}
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
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/CategoryPieChart.tsx
git commit -m "feat: CategoryPieChart clickable slices with dimming + legend"
```

---

### Task 7: BalanceHistoryChart

**Files:**
- Create: `frontend/src/components/Dashboard/BalanceHistoryChart.tsx`

- [ ] **Step 1: Create BalanceHistoryChart**

```tsx
// frontend/src/components/Dashboard/BalanceHistoryChart.tsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";

interface BalancePoint {
  year: number; month: number; income: number;
  expense: number; balance: number; cumulative: number;
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function BalanceHistoryChart({ data }: { data: BalancePoint[] }) {
  const chartData = data.map((d) => ({
    name: `${MONTHS[d.month - 1]}/${String(d.year).slice(2)}`,
    Acumulado: d.cumulative,
    Mensal: d.balance,
  }));

  return (
    <div className="bg-[#1e293b] rounded-xl p-4">
      <h3 className="text-sm text-[#94a3b8] mb-3">Saldo acumulado — 12 meses</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} />
          <YAxis tick={{ fill: "#475569", fontSize: 10 }} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            formatter={(v) =>
              `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            }
          />
          <Line
            type="monotone" dataKey="Acumulado"
            stroke="#38bdf8" strokeWidth={2} dot={false}
          />
          <Line
            type="monotone" dataKey="Mensal"
            stroke="#4ade80" strokeWidth={1.5} dot={false} strokeDasharray="5 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/BalanceHistoryChart.tsx
git commit -m "feat: BalanceHistoryChart line chart 12 months cumulative + monthly"
```

---

### Task 8: Dashboard page refactor

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite Dashboard.tsx**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import type { DashboardData, Category } from "../types";
import api from "../api/client";
import { usePersonStore } from "../store/person";
import { useFilterStore } from "../store/filter";
import FilterBar from "../components/Dashboard/FilterBar";
import KpiCards from "../components/Dashboard/KpiCards";
import CategoryPieChart from "../components/Dashboard/CategoryPieChart";
import MonthlyBarChart from "../components/Dashboard/MonthlyBarChart";
import BalanceHistoryChart from "../components/Dashboard/BalanceHistoryChart";

interface BalancePoint {
  year: number; month: number; income: number;
  expense: number; balance: number; cumulative: number;
}

export default function Dashboard() {
  const { person } = usePersonStore();
  const { month, year, categoryId, setMonth, setCategory } = useFilterStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalancePoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.get<Category[]>("/categories").then((r) => setCategories(r.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      month: String(month), year: String(year), person,
    });
    if (categoryId) params.set("category_id", categoryId);
    api.get<DashboardData>(`/dashboard?${params}`).then((r) => setData(r.data));
  }, [person, month, year, categoryId]);

  useEffect(() => {
    api
      .get<BalancePoint[]>(`/dashboard/balance-history?person=${person}`)
      .then((r) => setBalanceHistory(r.data));
  }, [person]);

  if (!data) return <div className="text-[#475569]">Carregando...</div>;

  return (
    <div className="space-y-5">
      <FilterBar categories={categories} />
      <KpiCards
        totalExpense={data.total_expense}
        totalIncome={data.total_income}
        balance={data.balance}
        vsLastMonthPct={data.vs_last_month_pct}
      />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <MonthlyBarChart
            data={data.monthly_history}
            selectedMonth={month}
            selectedYear={year}
            onMonthClick={setMonth}
          />
        </div>
        <CategoryPieChart
          data={data.by_category}
          selectedCategoryId={categoryId}
          onCategoryClick={setCategory}
        />
      </div>
      <BalanceHistoryChart data={balanceHistory} />
      <div className="bg-[#1e293b] rounded-xl p-4">
        <h3 className="text-sm text-[#94a3b8] mb-3">
          Últimas transações{categoryId ? " · filtrado por categoria" : ""}
        </h3>
        <div className="space-y-2">
          {data.recent_transactions.map((t) => (
            <div key={t.id} className="flex justify-between text-sm">
              <span className="text-[#94a3b8]">
                {t.date} · {t.description}
              </span>
              <span className={Number(t.amount) < 0 ? "text-[#fb923c]" : "text-[#4ade80]"}>
                R$ {Math.abs(Number(t.amount)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: `✓ built in Xs` with 0 TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: dashboard refactor -- cross-filtering, KPI cards, balance history"
```

---

### Task 9: Sidebar + global theme

**Files:**
- Modify: `frontend/src/components/Layout/Sidebar.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Transactions.tsx`
- Modify: `frontend/src/pages/Categories.tsx`
- Modify: `frontend/src/pages/Plans.tsx`
- Modify: `frontend/src/pages/Trends.tsx`
- Modify: `frontend/src/pages/Import.tsx`

**Color replacements to apply across ALL files:**

| Old | New |
|---|---|
| `bg-[#0f0f1a]` | `bg-[#0f172a]` |
| `bg-[#1a1a2e]` | `bg-[#1e293b]` |
| `border-[#333]` | `border-[#334155]` |
| `bg-[#7c6af7]` | `bg-sky-500` |
| `text-[#7c6af7]` | `text-[#38bdf8]` |
| `ring-[#7c6af7]` | `ring-[#38bdf8]` |
| `bg-[#252540]` | `bg-[#334155]` |
| `text-red-400` (expense amounts) | `text-[#fb923c]` |
| `text-green-400` (income amounts) | `text-[#4ade80]` |

- [ ] **Step 1: Update Sidebar.tsx**

```tsx
// frontend/src/components/Layout/Sidebar.tsx
import { Outlet, NavLink } from "react-router-dom";
import PersonFilter from "./PersonFilter";

const navItems = [
  { to: "/dashboard", icon: "📊", label: "Dashboard" },
  { to: "/import", icon: "📥", label: "Importar" },
  { to: "/transactions", icon: "💳", label: "Transações" },
  { to: "/categories", icon: "🏷️", label: "Categorias" },
  { to: "/plans", icon: "🎯", label: "Planos" },
  { to: "/trends", icon: "📈", label: "Tendências" },
];

export default function Sidebar() {
  return (
    <div className="flex h-screen bg-[#0f172a]">
      <aside className="w-52 bg-[#1e293b] border-r border-[#334155] flex flex-col py-4 gap-2 shrink-0">
        <div className="px-4 pb-2 text-[#38bdf8] font-bold text-lg">Finanças</div>
        <nav className="flex-1 flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sky-500 text-white"
                    : "text-[#94a3b8] hover:text-white hover:bg-[#334155]"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[#334155] pt-3">
          <p className="px-4 text-xs text-[#475569] mb-2">Visualizar</p>
          <PersonFilter />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Apply color replacements to all other pages**

For each file in `frontend/src/pages/` (Login, Transactions, Categories, Plans, Trends, Import), replace the old color values with new ones per the table above. Also update amount colors: `text-red-400` → `text-[#fb923c]`, `text-green-400` → `text-[#4ade80]`.

Note: `frontend/src/components/Dashboard/SummaryCards.tsx` is **no longer rendered** — the new `Dashboard.tsx` uses `KpiCards` instead. Do NOT import or render `SummaryCards` in the new Dashboard. The file can be left in place (unused) or deleted.

- [ ] **Step 3: Also update Transactions.tsx to read from filter store on mount**

In `frontend/src/pages/Transactions.tsx`, add at the top:

```tsx
import { useFilterStore } from "../store/filter";
// inside component:
const { categoryId } = useFilterStore();
const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId);
```

This pre-populates the category filter if the user navigated from the dashboard.

- [ ] **Step 4: Final build check**

```bash
cd frontend && npm run build 2>&1 | tail -15
```

Expected: `✓ built in Xs`, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Layout/Sidebar.tsx \
        frontend/src/components/Dashboard/SummaryCards.tsx \
        frontend/src/pages/Login.tsx \
        frontend/src/pages/Transactions.tsx \
        frontend/src/pages/Categories.tsx \
        frontend/src/pages/Plans.tsx \
        frontend/src/pages/Trends.tsx \
        frontend/src/pages/Import.tsx
git commit -m "feat: Slate Modern theme applied globally"
```

---

### Task 10: Deploy to VPS

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: On VPS, pull and rebuild**

```bash
git pull && docker compose up -d --build
```

- [ ] **Step 3: Verify app loads at `http://IP_DA_VPS:4200`**

Check:
- Dashboard loads with new layout
- Clicking a bar month → updates pie + transactions
- Clicking a pie slice → shows category pill + filters transactions
- `×` on category pill → clears filter
- Balance history line chart shows 12 months
- All pages have Slate Modern colors
