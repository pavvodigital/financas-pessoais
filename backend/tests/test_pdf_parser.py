import os
import pytest
from app.services.pdf_parser import parse_credit_card_pdf, parse_statement_pdf

FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")
EXTRATO = os.path.join(os.path.dirname(__file__), "fixtures/extrato_sample.pdf")

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


def test_parse_extrato_returns_transactions():
    txs = parse_statement_pdf(EXTRATO)
    assert len(txs) > 0

def test_extrato_has_salary():
    txs = parse_statement_pdf(EXTRATO)
    incomes = [t for t in txs if "SALARIO" in t["description"].upper() or "REMUNERACAO" in t["description"].upper()]
    assert len(incomes) > 0

def test_extrato_salary_is_positive():
    txs = parse_statement_pdf(EXTRATO)
    salary = next(t for t in txs if "REMUNERACAO" in t["description"].upper())
    assert salary["amount"] > 0

def test_extrato_skips_saldo_lines():
    txs = parse_statement_pdf(EXTRATO)
    descs = [t["description"] for t in txs]
    assert not any("SALDO DO DIA" in d for d in descs)
