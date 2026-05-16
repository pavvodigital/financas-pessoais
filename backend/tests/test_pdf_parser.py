import os
import pytest
from app.services.pdf_parser import parse_credit_card_pdf

FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")

def test_parse_fatura_returns_transactions():
    txs = parse_credit_card_pdf(FATURA)
    assert len(txs) > 0

def test_fatura_transaction_fields():
    txs = parse_credit_card_pdf(FATURA)
    tx = txs[0]
    assert "date" in tx
    assert "description" in tx
    assert "amount" in tx
    assert tx["amount"] < 0  # expenses are negative
    assert "itau_category" in tx

def test_fatura_contains_uber():
    txs = parse_credit_card_pdf(FATURA)
    descs = [t["description"].upper() for t in txs]
    assert any("UBER" in d for d in descs)
