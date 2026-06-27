# UI Redesign (Minimal claro + verde) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaginar a UI inteira do app de dark cravado para um sistema "minimal editorial" claro com acento verde esmeralda.

**Architecture:** Tailwind v4 (config via `@theme` no `index.css`). Define-se tokens semânticos (paper/surface/ink/muted/hairline/accent), cria-se um conjunto de componentes reutilizáveis em `components/ui/`, e refatora-se cada página trocando os hex dark cravados pelos tokens/componentes. Sem tocar em lógica/dados.

**Tech Stack:** React + TypeScript + Tailwind v4 + recharts + Vite.

**Spec:** `docs/superpowers/specs/2026-06-27-ui-redesign-minimal-design.md`

**Verificação por tarefa:** `npx tsc -b` (build limpo) + revisão visual no app (deploy ou `npm run dev`).

---

### Task 1: Fundação — tokens, fonte, base clara

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html` (preconnect + Inter)

- [ ] Definir `@theme` no `index.css` com cores: `--color-paper #faf9f7`, `--color-surface #ffffff`, `--color-ink #111111`, `--color-muted #78716c`, `--color-hairline #ece9e3`, `--color-accent #047857`, `--color-accent-tint #ecfdf5`, `--color-danger #b91c1c`; `--font-sans` Inter.
- [ ] `body { background: paper; color: ink; }` (trocar o dark atual).
- [ ] `index.html`: adicionar Inter via Google Fonts (preconnect + link).
- [ ] Verificar: `npx tsc -b` e abrir app — fundo claro, fonte Inter.
- [ ] Commit.

### Task 2: Componentes reutilizáveis `components/ui/`

**Files (Create):**
- `frontend/src/components/ui/Card.tsx` — `<div>` surface + hairline + padding (`p-5 rounded-lg border border-hairline bg-surface`).
- `frontend/src/components/ui/KpiStat.tsx` — props: label, value, delta?, accent?. Label uppercase tracking muted; valor grande `text-2xl/3xl tracking-tight text-ink`.
- `frontend/src/components/ui/SectionTitle.tsx` — label uppercase tracking muted.
- `frontend/src/components/ui/FilterPill.tsx` — props: active, onClick, children. Ativo = `bg-accent text-white`, inativo = `border-hairline text-muted`.
- `frontend/src/components/ui/DataTable.tsx` — wrapper de tabela: head muted, linhas com `border-b border-hairline`, hover `bg-paper`.
- `frontend/src/lib/chartTheme.ts` — constantes: `GRID='#ece9e3'`, `AXIS='#a8a29e'`, `BAR='#d6d3d1'`, `BAR_ACTIVE='#047857'`, `INK='#111111'`, tooltip style claro.
- [ ] Verificar `npx tsc -b`. Commit.

### Task 3: Layout / Sidebar

**Files:** Modify `frontend/src/components/Layout/Sidebar.tsx`, `frontend/src/components/Layout/PersonFilter.tsx`
- [ ] Sidebar clara: fundo `surface`/`paper`, borda hairline à direita, nav só texto (ativo = ink bold + barrinha accent; inativo = muted). Logo "Finanças" em ink.
- [ ] `main` com fundo paper, padding generoso.
- [ ] Verificar visual. Commit.

### Task 4: Dashboard

**Files:** Modify `frontend/src/pages/Dashboard.tsx`, `components/Dashboard/{KpiCards,FilterBar,MonthlyBarChart,CategoryPieChart,SummaryCards,BalanceHistoryChart}.tsx`
- [ ] KpiCards → `KpiStat` em linha com divisórias hairline.
- [ ] FilterBar → `FilterPill` + seletor de mês minimal.
- [ ] Gráficos → usar `chartTheme` (cinza + accent no foco). Pizza → donut minimal ou barras de categoria.
- [ ] Últimas transações → `DataTable`.
- [ ] Verificar. Commit.

### Task 5: Parcelas

**Files:** Modify `frontend/src/pages/Installments.tsx`
- [ ] Cards → `KpiStat`; gráfico realizado×a-vencer com `chartTheme` (cinza passado, accent futuro); tabela → `DataTable`.
- [ ] Verificar. Commit.

### Task 6: Custos Fixos

**Files:** Modify `frontend/src/pages/FixedCosts.tsx`
- [ ] Cards/total → `KpiStat`; lista fixos + sugestões → `DataTable`/linhas hairline; botão "marcar" estilo accent.
- [ ] Verificar. Commit.

### Task 7: Transações

**Files:** Modify `frontend/src/pages/Transactions.tsx`
- [ ] Tabela → `DataTable`; filtros → `FilterPill`; selects/inputs claros.
- [ ] Verificar. Commit.

### Task 8: Tendências, Categorias, Planos

**Files:** Modify `frontend/src/pages/{Trends,Categories,Plans}.tsx`
- [ ] Aplicar tokens/componentes; gráficos via `chartTheme`.
- [ ] Verificar. Commit.

### Task 9: Importar, Login, PreviewTable

**Files:** Modify `frontend/src/pages/{Import,Login}.tsx`, `components/Import/{DropZone,PreviewTable}.tsx`
- [ ] DropZone claro (hairline tracejado); PreviewTable → `DataTable`; Login minimal centralizado.
- [ ] Verificar. Commit.

### Task 10: Polimento + deploy

- [ ] Varredura: buscar hex dark remanescentes (`#0f172a|#1e293b|#334155|#94a3b8|text-gray|bg-\[#`) e trocar.
- [ ] `npm run build` limpo.
- [ ] Deploy VPS (`git pull && docker compose up -d --build`).
- [ ] Revisão visual final tela a tela.

## Não-objetivos
- Sem mudança de backend/lógica/dados. Sem features novas (filtros/ferramentas = outra fatia).
