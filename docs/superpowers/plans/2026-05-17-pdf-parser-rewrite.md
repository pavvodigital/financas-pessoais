# PDF Parser Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Itaú credit card PDF parsing: use bounding-box word extraction to correctly separate two-column layouts, strip installment tags from merchant names, store installment metadata, and reject unsupported banks.

**Architecture:** Replace `page.extract_text()` with `page.extract_words()` in `parse_credit_card_pdf`. Words are split by x-position into left/right columns, grouped by y-coordinate into rows, and each row parsed individually with the existing `TX_LINE` regex. Installment tag (`NN/NN`) is stripped from merchant name after TX_LINE match. Two new nullable integer columns added to `transactions` table via alembic migration.

**Tech Stack:** Python 3.12, pdfplumber, SQLAlchemy 2, Alembic, pytest

---

## File Map

**Modified:**
- `backend/app/services/pdf_parser.py` — rewrite `parse_credit_card_pdf` using bbox words
- `backend/app/models/transaction.py` — add `installment_current`, `installment_total`
- `backend/app/routers/upload.py` — add `_detect_bank` + 422 for unknown banks

**New:**
- `backend/alembic/versions/c4d5e6f7a8b9_add_installment_columns.py`
- `backend/tests/test_pdf_parser_bbox.py`

---

### Task 1: DB migration — installment columns

**Files:**
- Modify: `backend/app/models/transaction.py`
- Create: `backend/alembic/versions/c4d5e6f7a8b9_add_installment_columns.py`

- [ ] **Step 1: Add columns to Transaction model**

In `backend/app/models/transaction.py`, add two lines after `manually_categorized`:

```python
installment_current: Mapped[int | None] = mapped_column(nullable=True)
installment_total: Mapped[int | None] = mapped_column(nullable=True)
```

- [ ] **Step 2: Create alembic migration**

```python
# backend/alembic/versions/c4d5e6f7a8b9_add_installment_columns.py
"""add installment columns to transactions

Revision ID: c4d5e6f7a8b9
Revises: b3f2a1c4d5e6
Create Date: 2026-05-17 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3f2a1c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('transactions', sa.Column('installment_current', sa.Integer(), nullable=True))
    op.add_column('transactions', sa.Column('installment_total', sa.Integer(), nullable=True))

def downgrade() -> None:
    op.drop_column('transactions', 'installment_total')
    op.drop_column('transactions', 'installment_current')
```

- [ ] **Step 3: Run existing tests to confirm model change doesn't break anything**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all tests pass (new nullable columns don't affect existing tests).

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/transaction.py \
        backend/alembic/versions/c4d5e6f7a8b9_add_installment_columns.py
git commit -m "feat: add installment_current/total columns to transactions"
```

---

### Task 2: PDF parser rewrite — bbox column extraction

**Files:**
- Modify: `backend/app/services/pdf_parser.py`
- Create: `backend/tests/test_pdf_parser_bbox.py`

**Key insight:** `pdfplumber`'s `extract_words()` returns a list of dicts:
```python
{"text": "AMAZON", "x0": 45.2, "x1": 89.1, "top": 142.5, "bottom": 155.0, ...}
```
Group by column (`x0 < page.width/2` = left, else right), then within each column group by `round(top / 3) * 3` (3pt tolerance for same row), sort words in each row by `x0`, join with spaces → one line per transaction.

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_pdf_parser_bbox.py
from app.services.pdf_parser import _group_words_into_lines

def test_group_words_into_lines_separates_two_columns():
    """Simulates two transactions merged into one line by extract_text."""
    # Left column: 28/04 TerapiasBastos 01/02 812,50
    # Right column: 06/04 FACEBK 415,28
    page_width = 595.0
    words = [
        {"text": "28/04", "x0": 45.0, "top": 142.0},
        {"text": "TerapiasBastos", "x0": 80.0, "top": 142.0},
        {"text": "01/02", "x0": 190.0, "top": 142.0},
        {"text": "812,50", "x0": 240.0, "top": 142.0},
        # right column same row
        {"text": "06/04", "x0": 320.0, "top": 142.0},
        {"text": "FACEBK", "x0": 355.0, "top": 142.0},
        {"text": "415,28", "x0": 430.0, "top": 142.0},
    ]
    lines = _group_words_into_lines(words, page_width)
    assert len(lines) == 2
    assert "TerapiasBastos" in lines[0]
    assert "FACEBK" in lines[1]
    assert "812,50" in lines[0]
    assert "415,28" in lines[1]

def test_group_words_into_lines_single_column():
    """Single-column pages still produce one line per row."""
    words = [
        {"text": "09/04", "x0": 45.0, "top": 100.0},
        {"text": "DM*Spotify", "x0": 80.0, "top": 100.0},
        {"text": "23,90", "x0": 200.0, "top": 100.0},
    ]
    lines = _group_words_into_lines(words, 595.0)
    assert len(lines) == 1
    assert "DM*Spotify" in lines[0]
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd backend && python -m pytest tests/test_pdf_parser_bbox.py -v 2>&1
```

Expected: `ImportError: cannot import name '_group_words_into_lines'`

- [ ] **Step 3: Implement `_group_words_into_lines` and rewrite `parse_credit_card_pdf`**

Add this helper function to `backend/app/services/pdf_parser.py` (after existing helpers, before `parse_statement_pdf`):

```python
def _group_words_into_lines(words: list[dict], page_width: float) -> list[str]:
    """Split pdfplumber word dicts into text lines, one per row per column.
    
    Itaú fatura PDFs have a two-column layout. extract_text() merges them.
    This function splits words by x-position (left vs right column) and
    groups by y-coordinate within each column to reconstruct individual lines.
    """
    mid = page_width / 2
    left  = [w for w in words if w["x0"] < mid]
    right = [w for w in words if w["x0"] >= mid]

    def to_lines(col_words: list[dict]) -> list[str]:
        rows: dict[int, list[dict]] = {}
        for w in col_words:
            # Round top to nearest 3pt to group words on the same visual row
            key = round(w["top"] / 3)
            rows.setdefault(key, []).append(w)
        lines = []
        for key in sorted(rows):
            row_words = sorted(rows[key], key=lambda w: w["x0"])
            lines.append(" ".join(w["text"] for w in row_words))
        return lines

    return to_lines(left) + to_lines(right)
```

Then rewrite `parse_credit_card_pdf` to use it. Replace the inner page-scanning loop (lines that do `text = page.extract_text()` and iterate `lines = text.splitlines()`) with:

```python
        for page in pdf.pages:
            words = page.extract_words(keep_blank_chars=False, extra_attrs=["top"])
            lines = _group_words_into_lines(words, page.width)

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                if not line or SKIP_LINE_RE.match(line):
                    i += 1
                    continue

                tx_match = TX_LINE.match(line)
                if tx_match:
                    day_month = tx_match.group(1)
                    description = tx_match.group(2).strip()
                    has_minus = bool(tx_match.group(3))
                    amount_raw = tx_match.group(4)

                    # Strip installment tag from merchant name: "AMAZON 01/06" → "AMAZON"
                    inst_current: int | None = None
                    inst_total: int | None = None
                    inst_match = re.search(r"\s+(\d{1,2})/(\d{1,2})$", description)
                    if inst_match:
                        inst_current = int(inst_match.group(1))
                        inst_total = int(inst_match.group(2))
                        description = description[:inst_match.start()].strip()

                    day, month = map(int, day_month.split("/"))
                    year = _resolve_year(month, statement_year, statement_month)
                    try:
                        tx_date = date(year, month, day)
                    except ValueError:
                        i += 1
                        continue

                    itau_cat: str | None = None
                    consumed_category = False
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        cat_match = CAT_LINE.match(next_line)
                        if cat_match:
                            itau_cat = _match_category(cat_match.group(1))
                            consumed_category = True

                    transactions.append({
                        "date": tx_date,
                        "description": description,
                        "merchant_name": _normalize_merchant(description),
                        "amount": _parse_amount(amount_raw, has_minus),
                        "itau_category": itau_cat,
                        "source": "credit_card",
                        "raw_text": line,
                        "installment_current": inst_current,
                        "installment_total": inst_total,
                    })

                    if consumed_category:
                        i += 2
                        continue

                i += 1
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_pdf_parser_bbox.py -v 2>&1
```

Expected: both tests PASS.

- [ ] **Step 5: Run all tests**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/pdf_parser.py backend/tests/test_pdf_parser_bbox.py
git commit -m "feat: rewrite parse_credit_card_pdf with bbox column extraction + installment strip"
```

---

### Task 3: Wire installment fields through upload router

**Files:**
- Modify: `backend/app/routers/upload.py`

The `confirm_upload` endpoint creates `Transaction` objects. It needs to pass `installment_current`/`installment_total` from the preview data through to the model.

- [ ] **Step 1: Update `TransactionIn` schema to include installment fields**

In `backend/app/schemas/transaction.py`, add to `TransactionIn`:

```python
class TransactionIn(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str] = None
    amount: float
    category_id: Optional[str] = None
    source: str
    raw_text: Optional[str] = None
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
```

Also add to `TransactionPreview`:

```python
class TransactionPreview(BaseModel):
    date: date
    description: str
    merchant_name: Optional[str] = None
    amount: float
    category_name: Optional[str] = None
    source: str
    raw_text: Optional[str] = None
    installment_current: Optional[int] = None
    installment_total: Optional[int] = None
```

- [ ] **Step 2: Pass installment fields in upload preview**

In `backend/app/routers/upload.py`, in the `upload_pdf` endpoint's preview loop, update `TransactionPreview(...)` to include:

```python
previews.append(
    TransactionPreview(
        ...
        installment_current=tx.get("installment_current"),
        installment_total=tx.get("installment_total"),
    )
)
```

- [ ] **Step 3: Pass installment fields when creating Transaction in `confirm_upload`**

```python
t = Transaction(
    ...
    installment_current=tx.installment_current,
    installment_total=tx.installment_total,
)
```

- [ ] **Step 4: Run all tests**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/transaction.py backend/app/routers/upload.py
git commit -m "feat: wire installment_current/total through upload preview and confirm"
```

---

### Task 4: Bank detection in upload router

**Files:**
- Modify: `backend/app/routers/upload.py`

- [ ] **Step 1: Write failing test**

In `backend/tests/test_upload.py`, add:

```python
def test_upload_unknown_bank_returns_422(client):
    """Non-Itaú PDF (no Itaú signature) should return 422."""
    import io
    # Minimal PDF bytes that won't contain Itaú markers
    fake_pdf = b"%PDF-1.4\n% not an itau pdf\n"
    token = client.post("/api/auth/login", json={"password": "test"}).json()["access_token"]
    r = client.post(
        "/api/upload",
        files={"file": ("bradesco.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        data={"person": "diogo"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422
    assert "suportado" in r.json()["detail"].lower()
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd backend && python -m pytest tests/test_upload.py::test_upload_unknown_bank_returns_422 -v 2>&1
```

Expected: FAIL (currently returns 200 or 500, not 422 with that message).

- [ ] **Step 3: Add `_detect_bank` to upload.py**

Add after `_detect_type` function:

```python
def _detect_bank(filename: str, content: bytes) -> str:
    name = filename.lower()
    if b"Banco Ita" in content or b"itaucard" in content or "itau" in name or "fatura" in name:
        return "itau"
    return "unknown"
```

Then in `upload_pdf`, after `content = await file.read()`, add:

```python
    bank = _detect_bank(file.filename or "", content)
    if bank == "unknown":
        raise HTTPException(status_code=422, detail="Banco não suportado. Apenas arquivos Itaú são aceitos.")
```

- [ ] **Step 4: Run test**

```bash
cd backend && python -m pytest tests/test_upload.py -v 2>&1 | tail -20
```

Expected: all pass including new test.

- [ ] **Step 5: Run all tests**

```bash
cd backend && python -m pytest tests/ -v 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/upload.py backend/tests/test_upload.py
git commit -m "feat: bank detection -- reject non-Itaú PDFs with 422"
```

---

### Task 5: Deploy

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: On VPS, pull and rebuild (migration runs on startup)**

```bash
git pull && docker compose up -d --build
```

- [ ] **Step 3: Verify parser fix**

Import one of the real Itaú fatura PDFs. Confirm:
- Merchant names no longer contain "01/06" style suffixes
- Transaction count is higher (previously merged two-column lines now produce 2 transactions each)
- No duplicate/garbled merchants
