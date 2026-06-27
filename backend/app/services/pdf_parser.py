"""
Parser for Itaú credit card statements (faturas).

The Itaú PDF is laid out in two columns; pdfplumber merges them
into a single flat stream of lines.  Each transaction occupies
two consecutive lines:

    Line 1:  DD/MM  MERCHANT [NN/NN]  AMOUNT
    Line 2:  CATEGORY .CITY

where AMOUNT can be:
    51,00         → positive (expense)
    - 0,55        → negative/credit (refund)
    1.234,56      → thousands separator

The year is extracted from the "Vencimento: DD/MM/YYYY" header on page 0.
"""

import calendar
import re
from datetime import date, datetime
from typing import Any

import pdfplumber

# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------

# Transaction line:
#   group 1 = DD/MM
#   group 2 = merchant (may include installment tag like "01/02")
#   group 3 = optional minus sign (credit/refund)
#   group 4 = amount digits (e.g. "51,00" or "1.234,56")
TX_LINE = re.compile(
    r"^(\d{2}/\d{2})\s+(.+?)\s+(-\s*)?([\d]{1,3}(?:\.\d{3})*,\d{2})$"
)

# Category line immediately after a TX_LINE:
#   ALIMENTAÇÃO .BELO HORIZONT
#   VEÍCULOS .Sao Paulo
#   TURISMO E ENTRETENIM.BARUERI   (no space before dot)
CAT_LINE = re.compile(r"^([A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]+?)\s*\.\s*\S", re.UNICODE)

# Bill-payment lines on the fatura (credit for paying the previous invoice).
# Not a purchase — skip it. Anchored at start so it does NOT match merchants
# like "MEIO DE PAGAMENTOS". Catches "PAGAMENTO", "Pagamento via conta",
# "Pagamentoviaconta".
PAYMENT_LINE_RE = re.compile(r"^pagamento", re.IGNORECASE)

# Vencimento date – captures day/month/year
VENCIMENTO_RE = re.compile(r"Vencimento:\s*(\d{2})/(\d{2})/(\d{4})")

# Special charges that don't appear as TX_LINE transactions
IOF_REPASSE_RE = re.compile(r"Repasse de IOF em R\$\s*([\d.]+,\d{2})")
ENCARGOS_SUMM_RE = re.compile(r"[A-Z]\s+Encargos\s*\([^)]*\)\s+([\d.]+,\d{2})")

# Lines that should be skipped (section headers, totals, etc.)
SKIP_LINE_RE = re.compile(
    r"^(DATA\s+ESTABELECIMENTO|Lan[çc]amentos|DIOGO|Continua|PC\s*-|"
    r"Compras parceladas|Pr[óo]xima fatura|Demais faturas|Total para|"
    r"Limites de cr[eé]dito|Limite|[0-9]{4}\s+[0-9]{4})",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Category mapping  (uppercase Itaú category → normalised label)
# ---------------------------------------------------------------------------
ITAU_CATEGORY_MAP: dict[str, str] = {
    "ALIMENTAÇÃO": "Alimentação",
    "VEÍCULOS": "Transporte",
    "VESTUÁRIO": "Vestuário",
    "DIVERSOS": "Outros",
    "SAÚDE": "Saúde",
    "EDUCAÇÃO": "Educação",
    "TURISMO E ENTRETENIM": "Lazer",
    "TURISMO E ENTRETENIMENTO": "Lazer",
    "ENTRETENIMENTO": "Lazer",
    "COMUNICAÇÃO": "Telecomunicações",
    "CASA": "Moradia",
    "VIAGENS": "Lazer",
}

# ---------------------------------------------------------------------------
# Merchant normalisation rules
# ---------------------------------------------------------------------------
MERCHANT_NORMALIZATIONS: list[tuple[re.Pattern, Any]] = [
    (re.compile(r"DL\s*\*\s*UberRides", re.I), "Uber"),
    (re.compile(r"Uber\s+UBER\s+\*TRIP", re.I), "Uber"),
    (re.compile(r"UBER\s*\*\s*TRIP", re.I), "Uber"),
    (re.compile(r"CPG\*(.+)", re.I), lambda m: m.group(1).strip()),
    (re.compile(r"FACEBK\s*\*.+", re.I), "Facebook Ads"),
    (re.compile(r"DM\*Spotify", re.I), "Spotify"),
    (re.compile(r"AmazonPrimeBR", re.I), "Amazon Prime"),
    (re.compile(r"Amazon\s+Prime\s+Canais", re.I), "Amazon Prime Canais"),
    (re.compile(r"APPLE\.COM/BILL\.", re.I), "Apple"),
]


def _normalize_merchant(raw: str) -> str:
    for pattern, replacement in MERCHANT_NORMALIZATIONS:
        if pattern.search(raw):
            if callable(replacement):
                return pattern.sub(replacement, raw)
            return replacement
    return raw.strip()


def _parse_amount(amount_str: str, has_minus: bool) -> float:
    """Convert Brazilian number string to a negative float (expense).

    Itaú amounts are always charges (positive in the PDF).
    Credits / refunds appear with an explicit leading '- '.
    We store expenses as negative values in our system.
    """
    try:
        value = float(amount_str.replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0
    if has_minus:
        # Credit / refund → positive in our system
        return value
    # Regular expense → negative in our system
    return -value


def _resolve_year(month: int, statement_year: int, statement_month: int) -> int:
    """Handle statements that include transactions from the prior month.

    If the transaction month is more than 1 month ahead of the statement month
    (modulo 12), the transaction belongs to the previous year.
    For example: a December transaction (month=12) in a January statement
    (statement_month=1) → 12 > 1 + 1 → prior year.
    """
    if month > statement_month + 1:
        return statement_year - 1
    return statement_year


def _match_category(raw_cat: str) -> str | None:
    raw_upper = raw_cat.strip().upper()
    # Exact match first
    if raw_upper in ITAU_CATEGORY_MAP:
        return ITAU_CATEGORY_MAP[raw_upper]
    # Prefix match
    for k, v in ITAU_CATEGORY_MAP.items():
        if raw_upper.startswith(k):
            return v
    return None



_DATE_WORD = re.compile(r"^\d{2}/\d{2}$")
_AMT_WORD = re.compile(r"^\d{1,3}(?:\.\d{3})*,\d{2}$")


def _group_words_into_lines(words: list[dict], page_width: float) -> list[str]:
    # Strategy: detect right-column date words (pure DD/MM at x0 > 45% of page
    # width) and anchor the split between those dates and the left-column amounts
    # that precede them.  This is robust against pages with full-width paragraph
    # text that fills every gap in the central band — the old gap-detection
    # approach fell back to page_width/2 (≈297.5 pt) which incorrectly placed
    # left-column amounts (x0≈321 pt) in the right column.
    lo = page_width * 0.30
    right_threshold = page_width * 0.45  # ≈268 pt on 595 pt page

    right_dates = [w for w in words if _DATE_WORD.match(w["text"]) and w["x0"] > right_threshold]

    if right_dates:
        right_col_start = min(w["x0"] for w in right_dates)
        left_amounts = [
            w for w in words
            if _AMT_WORD.match(w["text"]) and lo <= w["x0"] < right_col_start
        ]
        if left_amounts:
            left_col_end = max(w["x0"] for w in left_amounts)
        else:
            left_col_end = lo
        mid = (left_col_end + right_col_start) / 2
    else:
        # Single-column page: fall back to largest-gap detection in central band.
        hi = page_width * 0.80
        central_x0 = sorted({round(w["x0"]) for w in words if lo <= w["x0"] <= hi})
        if len(central_x0) >= 2:
            gaps = [
                (central_x0[i + 1] - central_x0[i], central_x0[i], central_x0[i + 1])
                for i in range(len(central_x0) - 1)
                if central_x0[i + 1] - central_x0[i] > 20
            ]
            if gaps:
                _, gap_lo, gap_hi = max(gaps)
                mid = (gap_lo + gap_hi) / 2
            else:
                mid = page_width / 2
        else:
            mid = page_width / 2

    left  = [w for w in words if w["x0"] < mid]
    right = [w for w in words if w["x0"] >= mid]

    def to_lines(col_words: list[dict]) -> list[str]:
        rows: dict[int, list[dict]] = {}
        for w in col_words:
            key = round(w["top"] / 3)
            rows.setdefault(key, []).append(w)
        lines = []
        for key in sorted(rows):
            row_words = sorted(rows[key], key=lambda w: w["x0"])
            lines.append(" ".join(w["text"] for w in row_words))
        return lines

    return to_lines(left) + to_lines(right)


# ---------------------------------------------------------------------------
# Bank statement (extrato) patterns
# ---------------------------------------------------------------------------

# Each extrato line:
#   DD/MM/YYYY  DESCRIPTION  [-]AMOUNT
# Examples:
#   15/05/2026 ITAU MC 4528-8298 -6.864,26
#   30/04/2026 REMUNERACAO/SALARIO 4.613,99
#   08/05/2026 PIX QRS KARINE GARC08/05 -15,00
STMT_LINE = re.compile(
    r"^(\d{2}/\d{2}/\d{4})\s+(.+?)\s+(-?[\d.]+,\d{2})$"
)

# Lines to skip in the extrato (balance summaries + credit card payment lines)
STMT_SKIP_RE = re.compile(
    r"SALDO DO DIA"
    r"|PAGAMENTO\s+FATURA"
    r"|FATURA\s+PAGA"
    r"|PAG\s+FATURA"
    r"|PAG\s+ITAUCARD"
    r"|DEBITO\s+AUT\s+CARTAO"
    r"|ITAU\s+MC\s+\d"
    r"|ITAU\s+VISA\s+\d"
    r"|DEBITO\s+AUTOMATICO\s+CARTAO",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_statement_pdf(path: str) -> list[dict[str, Any]]:
    """Parse an Itaú bank statement (extrato) PDF and return a list of transactions.

    Each transaction dict contains:
        date          : datetime.date
        description   : str   (raw description from PDF)
        merchant_name : str   (normalised merchant/description)
        amount        : float (negative = debit/expense, positive = credit/income)
        itau_category : None  (not available in extrato)
        source        : "bank"
        raw_text      : str   (original line from PDF)
    """
    transactions: list[dict[str, Any]] = []

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                m = STMT_LINE.match(line)
                if not m:
                    continue
                date_str, desc, amount_raw = m.group(1), m.group(2).strip(), m.group(3)
                # Skip balance summary lines
                if STMT_SKIP_RE.search(desc):
                    continue
                day, month, year = map(int, date_str.split("/"))
                try:
                    tx_date = date(year, month, day)
                except ValueError:
                    continue
                try:
                    amount = float(amount_raw.replace(".", "").replace(",", "."))
                except ValueError:
                    continue
                transactions.append(
                    {
                        "date": tx_date,
                        "description": desc,
                        "merchant_name": _normalize_merchant(desc),
                        "amount": amount,
                        "itau_category": None,
                        "source": "bank",
                        "raw_text": line,
                    }
                )

    return transactions


def parse_credit_card_pdf(path: str) -> list[dict[str, Any]]:
    """Parse an Itaú credit card statement PDF and return a list of transactions.

    Each transaction dict contains:
        date          : datetime.date
        description   : str   (raw merchant name from PDF)
        merchant_name : str   (normalised merchant name)
        amount        : float (negative = expense, positive = credit/refund)
        itau_category : str | None
        source        : "credit_card"
        raw_text      : str   (original transaction line)
    """
    transactions: list[dict[str, Any]] = []

    with pdfplumber.open(path) as pdf:
        # --- 1. Collect page texts + detect vencimento date (day/month/year) ---
        statement_year: int = datetime.now().year
        statement_month: int = datetime.now().month
        statement_day: int = 1
        vencimento_date: date | None = None
        page_texts: list[str] = []

        for page in pdf.pages:
            text = page.extract_text() or ""
            page_texts.append(text)
            if vencimento_date is None:
                m = VENCIMENTO_RE.search(text)
                if m:
                    statement_day = int(m.group(1))
                    statement_month = int(m.group(2))
                    statement_year = int(m.group(3))
                    try:
                        vencimento_date = date(statement_year, statement_month, statement_day)
                    except ValueError:
                        vencimento_date = date(statement_year, statement_month, 1)

        if vencimento_date is None:
            vencimento_date = date(statement_year, statement_month, statement_day)

        # --- 2. Scan every page line by line ---
        for page in pdf.pages:
            words = page.extract_words(keep_blank_chars=False, extra_attrs=["top"])
            lines = _group_words_into_lines(words, page.width)

            # Once we hit the "Compras parceladas - próximas faturas" section
            # (future installment summary), stop accepting TX_LINE matches for
            # this page — those lines are not real charges for the current month.
            past_future_section = False

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                if not line:
                    i += 1
                    continue

                if SKIP_LINE_RE.match(line):
                    # If this is a future-section marker, set the stop flag.
                    if re.search(r"Compras parceladas|Pr[óo]xima fatura|Demais faturas", line, re.IGNORECASE):
                        past_future_section = True
                    i += 1
                    continue

                if past_future_section:
                    i += 1
                    continue

                tx_match = TX_LINE.match(line)
                if tx_match:
                    day_month = tx_match.group(1)
                    description = tx_match.group(2).strip()
                    has_minus = bool(tx_match.group(3))
                    amount_raw = tx_match.group(4)

                    # Pagamento da fatura anterior aparece como crédito — não é
                    # compra, ignora pra não distorcer o gasto.
                    if PAYMENT_LINE_RE.match(description):
                        i += 1
                        continue

                    inst_current: int | None = None
                    inst_total: int | None = None
                    inst_match = re.search(r"\s*(\d{1,2})/(\d{1,2})$", description)
                    if inst_match:
                        cur = int(inst_match.group(1))
                        tot = int(inst_match.group(2))
                        if 1 <= cur <= tot <= 96:
                            inst_current = cur
                            inst_total = tot
                            description = description[:inst_match.start()].strip()

                    day, month = map(int, day_month.split("/"))
                    year = _resolve_year(month, statement_year, statement_month)
                    try:
                        purchase_date = date(year, month, day)
                    except ValueError:
                        i += 1
                        continue

                    # Always attribute to billing month so filtering by month
                    # matches the fatura total exactly. Purchases made late in
                    # a cycle close in the next fatura regardless of purchase date.
                    last_day = calendar.monthrange(statement_year, statement_month)[1]
                    tx_date = date(statement_year, statement_month, min(day, last_day))
                    orig_date = purchase_date  # preserve actual purchase date

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
                        "original_purchase_date": orig_date,
                    })

                    if consumed_category:
                        i += 2
                        continue

                i += 1

        # --- 3. Special charges: Repasse de IOF and Encargos financeiros ---
        # These appear as summary/total lines that don't match TX_LINE format.
        full_text = "\n".join(page_texts)

        iof_m = IOF_REPASSE_RE.search(full_text)
        if iof_m:
            val = float(iof_m.group(1).replace(".", "").replace(",", "."))
            transactions.append({
                "date": vencimento_date,
                "description": "Repasse de IOF Internacional",
                "merchant_name": "Repasse de IOF Internacional",
                "amount": -val,
                "itau_category": None,
                "source": "credit_card",
                "raw_text": iof_m.group(0).strip(),
                "installment_current": None,
                "installment_total": None,
                "original_purchase_date": None,
            })

        enc_m = ENCARGOS_SUMM_RE.search(full_text)
        if enc_m:
            val = float(enc_m.group(1).replace(".", "").replace(",", "."))
            transactions.append({
                "date": vencimento_date,
                "description": "Encargos Financeiros",
                "merchant_name": "Encargos Financeiros",
                "amount": -val,
                "itau_category": None,
                "source": "credit_card",
                "raw_text": enc_m.group(0).strip(),
                "installment_current": None,
                "installment_total": None,
                "original_purchase_date": None,
            })

    return transactions
