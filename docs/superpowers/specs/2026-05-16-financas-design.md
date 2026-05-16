# Sistema de Finanças Pessoais — Design Spec
**Data:** 2026-05-16  
**Usuários:** Diogo e Lis (conta compartilhada)

---

## 1. Visão Geral

App web de finanças pessoais hospedado em VPS. Importa extratos PDF do Itaú (conta corrente e fatura de cartão de crédito) para ambos os usuários, auto-categoriza transações, exibe dashboards com gráficos, rastreia gastos por pessoa/categoria/estabelecimento, e permite criar planos de economia com limites mensais por categoria.

**Benchmark de referência:**
- **Organizze / Mobills (BR):** categorias, orçamentos, relatórios — referência local
- **YNAB (US):** envelope budgeting, foco em metas — inspira o módulo de planos
- **Copilot (US):** busca por estabelecimento, tendências mês a mês — inspira o módulo de tendências
- **Monarch Money (US):** sidebar + dark mode, net worth — inspira o layout

---

## 2. Stack Técnica

```
VPS (Ubuntu)
├── nginx               — reverse proxy + serve React build estático
├── FastAPI (Python)    — REST API
├── PostgreSQL          — banco de dados principal
└── Docker Compose      — orquestração de serviços
```

**Dependências principais:**
- `pdfplumber` — extração de texto de PDFs Itaú
- `fastapi` + `uvicorn` — servidor ASGI
- `sqlalchemy` + `alembic` — ORM + migrations
- `react` + `recharts` + `tailwindcss` — frontend

---

## 3. Modelos de Dados

```sql
-- Categorias de gasto
Category
  id UUID PK
  name VARCHAR(100)           -- ex: "Alimentação"
  color VARCHAR(7)            -- hex: "#7c6af7"
  icon VARCHAR(50)            -- emoji: "🍔"
  monthly_budget DECIMAL(10,2) NULLABLE  -- limite padrão (sem plano)
  created_at TIMESTAMP

-- Regras de auto-categorização
CategoryRule
  id UUID PK
  category_id UUID FK → Category
  keyword VARCHAR(200)        -- ex: "UBER", "TIM CELU", "CEMIG"
  match_type ENUM(contains, starts_with, exact)
  priority INT                -- regras mais específicas primeiro

-- Arquivos importados
UploadedFile
  id UUID PK
  filename VARCHAR(255)
  file_type ENUM(statement, credit_card)  -- extrato ou fatura
  person ENUM(diogo, lis)
  month INT
  year INT
  imported_at TIMESTAMP
  transaction_count INT

-- Transações
Transaction
  id UUID PK
  date DATE
  description VARCHAR(500)    -- texto original do PDF
  amount DECIMAL(10,2)        -- negativo=gasto, positivo=receita
  type ENUM(expense, income, transfer, investment)
  category_id UUID FK → Category NULLABLE
  person ENUM(diogo, lis, joint)
  source ENUM(bank, credit_card)
  file_id UUID FK → UploadedFile
  merchant_name VARCHAR(200)  -- normalizado (ex: "Uber" de "DL*UberRides")
  raw_text VARCHAR(500)       -- linha original do PDF
  manually_categorized BOOL DEFAULT FALSE

-- Planos de economia
SavingsPlan
  id UUID PK
  name VARCHAR(200)           -- ex: "Viagem Europa 2027"
  goal_amount DECIMAL(10,2)
  target_date DATE
  is_active BOOL DEFAULT TRUE
  created_at TIMESTAMP

-- Limites por categoria dentro de um plano
PlanCategoryBudget
  id UUID PK
  plan_id UUID FK → SavingsPlan
  category_id UUID FK → Category
  monthly_limit DECIMAL(10,2)
```

---

## 4. Categorias Padrão (seed)

| Nome | Ícone | Keywords de auto-categorização |
|------|-------|-------------------------------|
| Alimentação | 🍔 | SUPERMERCAD, PAO, PADARIA, RESTAUR, ALIMENT, LANCHE, BOTECO, BAR DO, ESPETINHO, MORI MORI |
| Transporte | 🚗 | UBER, DL*UBER, POSTO, COMBUSTIV, ESTACION, ONIBUS, METRO |
| Moradia | 🏠 | CEMIG, ALUGUEL, CONDOMIN, AGUA, SANEAM, BOLETO O MESMO (parcial) |
| Saúde | 🏥 | FARMACIA, DROGARIA, CLINICA, MEDIC, HOSPITAL, PLANO SAUDE |
| Educação | 📚 | ESCOLA, FACULDAD, CURSO, UDEMY, LIVRO |
| Lazer | 🎭 | CINEMA, TEATRO, SHOW, SPOTIFY, NETFLIX, STEAM |
| Vestuário | 👗 | VESTUARIO, ROUPA, CALCADO, LOJA |
| Telecomunicações | 📱 | TIM CELU, VIVO, CLARO, OI, INTERNET |
| Energia | ⚡ | CEMIG DISTR, INT /CEMIG |
| Serviços & Seguros | 🔒 | SEGURO, BRADESCO SEG, PAY2ALL |
| Investimentos | 📈 | REND PAGO APLIC, APLIC AUT |
| Renda | 💰 | REMUNERACAO, SALARIO, PIX TRANSF 56.092 (recebimentos recorrentes) |
| Transferências | 🔄 | PIX TRANSF (saída para pessoas) |
| Outros | ❓ | fallback |

---

## 5. Parsing de PDF

### 5.1 Fatura de Cartão de Crédito
O PDF da fatura Itaú já contém a categoria de cada compra (ex: `ALIMENTAÇÃO .BELO HORIZONT`).

**Fluxo:**
1. Extrair texto com `pdfplumber`
2. Regex para capturar linhas: `DD/MM NOME_ESTABELECIMENTO VALOR`
3. Capturar categoria da linha seguinte (padrão Itaú: `CATEGORIA .CIDADE`)
4. Mapear categoria Itaú → categoria interna
5. Normalizar nome do estabelecimento (ex: `DL*UberRides` → `Uber`)

**Mapeamento de categorias Itaú:**
```python
ITAU_CATEGORY_MAP = {
    "ALIMENTAÇÃO": "Alimentação",
    "VEÍCULOS": "Transporte",
    "VESTUÁRIO": "Vestuário",
    "DIVERSOS": "Outros",
    "SAÚDE": "Saúde",
    "EDUCAÇÃO": "Educação",
    "ENTRETENIMENTO": "Lazer",
    "COMUNICAÇÃO": "Telecomunicações",
    "CASA": "Moradia",
    "VIAGENS": "Lazer",
}
```

Categorias Itaú não mapeadas → fallback: tentar keyword matching via `CategoryRule`; se não encontrar → "Outros".

### 5.2 Extrato Conta Corrente
Sem categorias explícitas — usar `CategoryRule` (keyword matching).

**Fluxo:**
1. Extrair texto com `pdfplumber`
2. Regex para capturar linhas: `DD/MM/YYYY DESCRICAO VALOR`
3. Ignorar linhas `SALDO DO DIA`
4. Determinar tipo: negativo=expense, positivo=income/transfer
5. Aplicar `CategoryRule` por prioridade de keyword
6. Merchant name: extrair nome limpo da descrição

### 5.3 Preview antes de salvar
Após parsing, o backend retorna as transações parseadas para o frontend exibir preview. Usuário pode corrigir categorias antes de confirmar importação.

---

## 6. API REST (FastAPI)

```
POST /api/upload                  — upload e parse de PDF (retorna preview)
  Body: multipart/form-data { file, person: "diogo"|"lis" }
  Response: { file_id_temp, transactions: [...parsed preview...] }

POST /api/upload/confirm          — confirma e salva transações no banco
  Body: { file_id_temp, transactions: [...parsed com edições do usuário...] }

GET  /api/dashboard               — resumo do mês (totais, por categoria)
GET  /api/dashboard?month=&year=&person=

GET  /api/transactions            — lista paginada com filtros
POST /api/transactions            — criar transação manual
PATCH /api/transactions/{id}      — editar categoria/pessoa

GET  /api/categories              — listar categorias
POST /api/categories              — criar categoria
PUT  /api/categories/{id}         — editar
DELETE /api/categories/{id}       — remover (reassigna transações → Outros)

GET  /api/categories/{id}/rules   — regras de categorização
POST /api/categories/{id}/rules   — adicionar regra

GET  /api/trends?category_id=&person=&months=12  — evolução mês a mês por categoria
GET  /api/trends/merchant?q=Uber&person=&months=12  — busca por estabelecimento com histórico

GET  /api/plans                   — listar planos de economia
POST /api/plans                   — criar plano
PUT  /api/plans/{id}              — editar
GET  /api/plans/{id}/status       — progresso atual vs. limites do mês
```

---

## 7. Frontend (React + Recharts + Tailwind)

### Layout: Sidebar fixa + conteúdo principal

```
┌─────────────────────────────────────────────┐
│  [Logo R$]                                  │
│  ─────────────                              │
│  📊 Dashboard        │  [Conteúdo da rota] │
│  📥 Importar         │                     │
│  💳 Transações       │                     │
│  🏷️  Categorias      │                     │
│  🎯 Planos           │                     │
│  📈 Tendências       │                     │
│  ─────────────       │                     │
│  Diogo / Lis / Ambos │                     │
└─────────────────────────────────────────────┘
```

### Páginas

**Dashboard:**
- Cards: Total gasto, Renda, Saldo, % vs. mês anterior
- PieChart: gastos por categoria (Recharts)
- BarChart: total mensal últimos 6 meses
- Lista: últimas 10 transações

**Importar:**
- Drag & drop PDF
- Select: Diogo / Lis
- Preview tabela de transações parseadas com categorias editáveis
- Botão "Confirmar importação"
- Histórico de arquivos importados

**Transações:**
- Tabela filtrável: período, categoria, pessoa, tipo
- Inline edit de categoria
- Criar transação manual

**Categorias:**
- Lista com cor/ícone/orçamento padrão
- CRUD
- Gerenciar regras de keyword por categoria

**Planos de Economia:**
- Lista de planos com progresso geral
- Detalhe: barras por categoria (gasto atual vs. limite)
- Alerta visual quando categoria estoura limite (vermelho)
- Projeção: "no ritmo atual, atinge meta em X meses"

**Tendências:**
- Campo de busca por estabelecimento (ex: "Uber")
- BarChart mês a mês com % crescimento vs. primeiro mês
- Alternativa: selecionar categoria para ver evolução
- Lista das últimas transações do estabelecimento

---

## 8. Autenticação

Sem login múltiplo — app é de uso doméstico em VPS privada. Mecanismo: formulário de login simples com senha única configurada via `APP_PASSWORD` no `.env`. Backend emite JWT com validade de 30 dias; frontend armazena em `localStorage` e envia como `Authorization: Bearer <token>`. Filtro Diogo/Lis é via seletor na interface (não autenticação separada).

---

## 9. Deployment

```yaml
# docker-compose.yml
services:
  db:       postgres:16
  api:      ./backend (FastAPI + uvicorn)
  frontend: nginx servindo React build estático
```

- `.env` com `DATABASE_URL`, `APP_PASSWORD`, `SECRET_KEY`
- Dados persistidos em volume Docker para PostgreSQL
- nginx proxy: `/api/*` → FastAPI, `/*` → React build

---

## 10. Fora de Escopo (v1)

- App mobile
- Integração direta com banco (Open Finance)
- Suporte a outros bancos além do Itaú
- Notificações / alertas por e-mail
- Exportação de relatórios PDF
