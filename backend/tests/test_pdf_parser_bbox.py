from app.services.pdf_parser import _group_words_into_lines, PAYMENT_LINE_RE


def test_payment_line_regex_skips_bill_payment_not_merchant():
    """Pagamento de fatura ignorado; merchant 'MEIO DE PAGAMENTOS' não."""
    assert PAYMENT_LINE_RE.match("PAGAMENTO")
    assert PAYMENT_LINE_RE.match("Pagamento via conta")
    assert PAYMENT_LINE_RE.match("Pagamentoviaconta")
    assert not PAYMENT_LINE_RE.match("MEIO DE PAGAMENTOS")
    assert not PAYMENT_LINE_RE.match("NETFLIX.COM")


def test_group_words_into_lines_separates_two_columns():
    """Simulates two transactions merged into one line by extract_text."""
    page_width = 595.0
    words = [
        {"text": "28/04", "x0": 45.0, "top": 142.0},
        {"text": "TerapiasBastos", "x0": 80.0, "top": 142.0},
        {"text": "01/02", "x0": 190.0, "top": 142.0},
        {"text": "812,50", "x0": 240.0, "top": 142.0},
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
