# UI Redesign — Minimal Editorial (claro + verde) — Design

**Data:** 2026-06-27
**Objetivo:** Repaginar a UI inteira do app de finanças. Hoje é dark com cores cravadas, visualmente fraca. Trocar por um sistema "minimal editorial" claro, com muito espaço em branco, tipografia grande, linhas finas e acento verde esmeralda.

## Direção (validada via mockups)

- Estilo: **Minimal Editorial**, fundo claro.
- Acento: **verde esmeralda** (`#047857`).
- Validado pelo usuário em 2026-06-27 (escolheu estilo C + acento verde).

## Design tokens

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#faf9f7` | fundo da app |
| `surface` | `#ffffff` | cartões, tabelas |
| `ink` | `#111111` | texto principal, números |
| `muted` | `#78716c` | labels, texto secundário |
| `hairline` | `#ece9e3` | divisórias finas |
| `accent` | `#047857` | destaque, valores positivos, barra do mês atual, item selecionado |
| `accent-tint` | `#ecfdf5` | fundo sutil de destaque |
| `danger` | `#b91c1c` | só estouro de orçamento / negativo crítico |

**Tipografia:** Inter (fallback system-ui). Números KPI grandes com `letter-spacing` apertado (`-0.5px`). Labels em MAIÚSCULAS pequenas com tracking (`+1px`). Hierarquia por tamanho, não por cor.

**Layout:** espaço em branco generoso; **hairlines** no lugar de caixas pesadas; cantos sutis (`rounded-lg`); sidebar só texto. Gráficos monocromáticos (cinza) com acento só no foco (mês atual, categoria selecionada).

## Componentes reutilizáveis (novos)

Criados uma vez em `frontend/src/components/ui/` e aplicados em todas as telas:

- `Card` — superfície branca, hairline, padding consistente.
- `KpiStat` — label pequena + número grande + delta opcional.
- `SectionTitle` — título de seção (label tracking).
- `DataTable` — tabela com linhas hairline, hover sutil.
- `FilterPill` — pílula de filtro (ativa = acento).
- `chartTheme.ts` — cores/eixos padrão dos gráficos recharts (cinza + acento).

## Escopo (todas as telas)

Dashboard, Transações, Parcelas, Custos Fixos, Categorias, Planos, Tendências, Importar, Login, Sidebar/Layout.

## Estratégia de implementação

1. **Fundação:** definir tokens no Tailwind (`tailwind.config`), trocar base dark→claro (`index.css`/`App.css`), importar Inter.
2. **Componentes ui/**: criar os reutilizáveis acima + `chartTheme`.
3. **Tela a tela:** refatorar cada página pro novo sistema, na ordem: Layout/Sidebar → Dashboard → Transações → Parcelas → Custos Fixos → Tendências → Categorias → Planos → Importar → Login.
4. Cada tela: trocar classes dark cravadas pelos tokens/componentes; sem mudar lógica/dados.

## Não-objetivos

- Não mexer em backend, lógica de cálculo, ou dados.
- Não adicionar features novas nesta fatia (filtros/ferramentas são fatia separada).
- Não fazer mobile-first agora (desktop primeiro; responsivo básico).

## Riscos

- Muitas cores dark cravadas em cada componente → trabalho mecânico amplo. Mitiga com tokens centrais + componentes reutilizáveis.
- Gráficos recharts têm cores inline → centralizar em `chartTheme`.
