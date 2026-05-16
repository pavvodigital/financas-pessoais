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

# Vencimento date – used to extract the statement year
VENCIMENTO_RE = re.compile(r"Vencimento:\s*\d{2}/\d{2}/(\d{4})")

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
    (re.compile(r"DL\s+\*\s*UberRides", re.I), "Uber"),
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
    value = float(amount_str.replace(".", "").replace(",", "."))
    if has_minus:
        # Credit / refund → positive in our system
        return value
    # Regular expense → negative in our system
    return -value


def _resolve_year(month: int, statement_year: int) -> int:
    """Handle January statements that include December transactions."""
    # If the statement is in month M and the transaction month is > M+1,
    # the transaction likely belongs to the previous year.
    if month > (datetime.now().month + 1) % 12 + 1:
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


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

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
        # --- 1. Detect statement year from the Vencimento field (page 0) ---
        statement_year: int = datetime.now().year
        for page in pdf.pages:
            text = page.extract_text() or ""
            m = VENCIMENTO_RE.search(text)
            if m:
                statement_year = int(m.group(1))
                break

        # --- 2. Scan every page line by line ---
        for page in pdf.pages:
            text = page.extract_text() or ""
            lines = text.splitlines()

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Skip known non-transaction lines quickly
                if not line or SKIP_LINE_RE.match(line):
                    i += 1
                    continue

                tx_match = TX_LINE.match(line)
                if tx_match:
                    day_month = tx_match.group(1)
                    description = tx_match.group(2).strip()
                    has_minus = bool(tx_match.group(3))
                    amount_raw = tx_match.group(4)

                    day, month = map(int, day_month.split("/"))
                    year = _resolve_year(month, statement_year)
                    try:
                        tx_date = date(year, month, day)
                    except ValueError:
                        i += 1
                        continue

                    # --- Look for category on the next line ---
                    itau_cat: str | None = None
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        cat_match = CAT_LINE.match(next_line)
                        if cat_match:
                            itau_cat = _match_category(cat_match.group(1))

                    transactions.append(
                        {
                            "date": tx_date,
                            "description": description,
                            "merchant_name": _normalize_merchant(description),
                            "amount": _parse_amount(amount_raw, has_minus),
                            "itau_category": itau_cat,
                            "source": "credit_card",
                            "raw_text": line,
                        }
                    )

                i += 1

    return transactions
