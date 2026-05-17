# Frontend Redesign — Dashboard Cross-Filtering & Slate Modern Theme

## Goal

Redesign the frontend with a Slate Modern dark theme, Power BI-style cross-filtering on the dashboard, a balance history line chart, and global visual polish across all pages.

## Tech Stack

React 18 + Vite + TypeScript + Tailwind CSS v4 + Recharts + Zustand (already in use)

---

## Design Decisions

### Theme: Slate Modern

| Token | Value | Use |
|---|---|---|
| Background | `#0f172a` | Page background |
| Surface | `#1e293b` | Cards, panels |
| Surface deep | `#0f172a` | Inputs, nested |
| Border | `#334155` | Card borders, dividers |
| Primary | `#38bdf8` | Income, selected state, links |
| Danger | `#fb923c` | Expenses |
| Success | `#4ade80` | Positive balance, savings |
| Accent | `#a78bfa` | Plans, secondary highlights |
| Text primary | `#f1f5f9` | Headings |
| Text secondary | `#94a3b8` | Labels, subtitles |
| Text muted | `#475569` | Placeholders, disabled |

All pages adopt this theme. Remove the previous `#1a1a2e` / `#7c6af7` palette.

---

## New: Filter Store

**File:** `frontend/src/store/filter.ts`

```ts
interface FilterState {
  month: number      // 1-12
  year: number
  categoryId: string | null
  setMonth: (month: number, year: number) => void
  setCategory: (id: string | null) => void
  clear: () => void
}
```

Initialized to current month/year, `categoryId: null`. Persisted in memory only (not localStorage — resets on page load, which is correct).

---

## Dashboard Page Redesign

### Layout (top to bottom)

1. **Filter Bar** — visible pills for active filters
   - Month selector (prev/next arrows + current label)
   - Person filter (Diogo / Lis / Ambos) — already exists in PersonFilter
   - Active category pill with × to clear (only shown when a category is selected)

2. **KPI Cards Row** (3 cards)
   - Gastos: total expenses for selected month/person + `▲/▼ X% vs mês anterior`
   - Renda: total income + trend indicator
   - Saldo: income minus expenses

3. **Charts Row** (two columns)
   - Left (2/3 width): Bar chart — gastos + renda por mês (últimos 6 meses)
     - Clicking a bar sets `month`/`year` in filter store
     - Selected month bar has highlight border
   - Right (1/3 width): Pie chart — gastos por categoria (filtered by active month)
     - Clicking a slice sets `categoryId` in filter store
     - Selected slice has highlight/offset

4. **Balance History** (full width)
   - Line chart — saldo acumulado mês a mês, últimos 12 meses
   - Data from new endpoint `GET /api/dashboard/balance-history`
   - No filter interaction (always shows 12-month view)

5. **Recent Transactions** (full width)
   - Filtered by active `month`, `year`, `categoryId`
   - Shows last 20 (up from 10)
   - Each row: date, merchant, category badge, amount

### Cross-Filtering Behaviour

- Bar chart click → `setMonth(m, y)` → pie + transactions re-fetch with new month
- Pie click → `setCategory(id)` → transactions list re-fetches with category filter
- Filter bar × on category pill → `setCategory(null)`
- Month arrows in filter bar → `setMonth(...)` → all charts update
- All data fetches subscribe to filter store; components re-render automatically

---

## New Backend Endpoint

### `GET /api/dashboard/balance-history`

**Query params:** `person` (diogo | lis | ambos)

**Response:**
```json
[
  { "year": 2026, "month": 1, "income": 8000, "expense": 5200, "balance": 2800, "cumulative": 2800 },
  { "year": 2026, "month": 2, "income": 8000, "expense": 6100, "balance": 1900, "cumulative": 4700 },
  ...
]
```

Returns last 12 months. `cumulative` = running sum of `balance`.

**File:** `backend/app/routers/dashboard.py` — new route added to existing router.

---

## Global Style Changes (all pages)

- Replace all `bg-[#1a1a2e]` → `bg-[#1e293b]`
- Replace all `bg-[#0f0f1a]` → `bg-[#0f172a]`
- Replace all `border-[#333]` → `border-[#334155]`
- Replace all `text-[#7c6af7]` → `text-[#38bdf8]` (links, active states)
- Replace all `bg-[#7c6af7]` → `bg-[#0ea5e9]` (primary buttons)
- Ring/focus: `ring-[#7c6af7]` → `ring-[#38bdf8]`
- Sidebar active nav: `bg-[#7c6af7]` → `bg-[#0ea5e9]`

### Sidebar icon additions

Each nav item gets an emoji icon prefix for faster scanning:
- Dashboard → 📊
- Importar → 📥
- Transações → 📋
- Categorias → 🏷️
- Planos → 🎯
- Tendências → 📈

---

## Transactions Page

Add `categoryId` filter param support: when user arrives from dashboard cross-filter click, the category filter is pre-populated. The filter store is shared — no URL params needed.

---

## Files Created / Modified

**New:**
- `frontend/src/store/filter.ts` — filter Zustand store
- `frontend/src/components/Dashboard/FilterBar.tsx` — month nav + active filter pills
- `frontend/src/components/Dashboard/KpiCards.tsx` — 3 KPI cards with trend %
- `frontend/src/components/Dashboard/BalanceHistoryChart.tsx` — line chart

**Modified:**
- `frontend/src/pages/Dashboard.tsx` — new layout, subscribes to filter store
- `frontend/src/components/Dashboard/CategoryPieChart.tsx` — clickable slices
- `frontend/src/components/Dashboard/MonthlyBarChart.tsx` — clickable bars, highlight selected
- `frontend/src/components/Layout/Sidebar.tsx` — icons + Slate Modern colors
- `frontend/src/pages/Transactions.tsx` — reads categoryId from filter store
- `frontend/src/pages/Categories.tsx` — Slate Modern theme
- `frontend/src/pages/Plans.tsx` — Slate Modern theme
- `frontend/src/pages/Trends.tsx` — Slate Modern theme
- `frontend/src/pages/Import.tsx` — Slate Modern theme
- `frontend/src/pages/Login.tsx` — Slate Modern theme
- `backend/app/routers/dashboard.py` — add `/api/dashboard/balance-history` route

---

## PDF Parser Rewrite (Itaú Credit Card)

### Problems Found in Real PDFs

**Problem 1 — Two-column merging:** pdfplumber's `extract_text()` merges the two-column layout of Itaú faturas into single lines, combining two transactions:
```
28/04 TerapiasBastos 01/02 812,50  06/04 FACEBK *YR5SLG9LB2 415,28
```
Current parser captures wrong merchant and wrong amount.

**Problem 2 — Installment tag in merchant name:** Installment purchases appear as `MERCHANT NN/NN` e.g. `TerapiasBastos 01/02`, `HTM*RB7 DIGITAL LT 07/12`. The `NN/NN` pollutes merchant name, breaking grouping and trend search.

### Solution: bbox-based column extraction

Replace `page.extract_text()` with `page.extract_words()` which returns each word with its X/Y bounding box. Split by column midpoint (`page.width / 2`), group words by Y-coordinate (±3pt tolerance) within each column, reconstruct one line per transaction.

```python
words = page.extract_words(keep_blank_chars=False, extra_attrs=["x0","top"])
mid = page.width / 2
left  = [w for w in words if w["x0"] < mid]
right = [w for w in words if w["x0"] >= mid]
# group each by rounded Y → reconstruct lines → apply TX_LINE regex
```

Category line peek logic (i+1) still works — category line is the next Y-row in the same column.

### Installment stripping

After merchant captured from TX_LINE, strip trailing ` NN/NN` pattern:
```python
INSTALLMENT_RE = re.compile(r"\s+(\d{1,2})/(\d{1,2})$")
m = INSTALLMENT_RE.search(merchant)
if m:
    installment_current, installment_total = int(m.group(1)), int(m.group(2))
    merchant = INSTALLMENT_RE.sub("", merchant).strip()
```

Store `installment_current: int | None` and `installment_total: int | None` on the Transaction model. New alembic migration required.

### Bank-detection architecture

Parser is and remains Itaú-specific. Future banks get their own parser function. Detection by filename/content:

```python
def _detect_bank(filename: str, content: bytes) -> str:
    if b"Banco Ita" in content or "itau" in filename.lower():
        return "itau"
    return "unknown"  # reject unknown banks with 422
```

`_detect_bank` added to `upload.py` — called before parser selection. Unknown bank returns HTTP 422 with `"Banco não suportado"`.

### Files modified

- `backend/app/services/pdf_parser.py` — rewrite `parse_credit_card_pdf` using bbox extraction + installment strip
- `backend/app/models/transaction.py` — add `installment_current`, `installment_total` columns
- `backend/app/routers/upload.py` — add `_detect_bank` check
- `backend/alembic/versions/` — new migration for installment columns

---

## Out of Scope

- Cashflow calendar view
- Budget health score
- Recurring expense detection
- Mobile-first layout (responsive improvements deferred)
- Month comparison side-by-side view
