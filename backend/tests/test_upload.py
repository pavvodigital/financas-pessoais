import os

FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")


def get_token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]


def auth(client):
    return {"Authorization": f"Bearer {get_token(client)}"}


def test_upload_fatura_returns_preview(client):
    with open(FATURA, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": ("fatura.pdf", f, "application/pdf")},
            data={"person": "diogo"},
            headers=auth(client),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "transactions" in data
    assert len(data["transactions"]) > 0
    assert "file_id_temp" in data


def test_upload_confirm_saves_transactions(client):
    # First upload to get preview
    with open(FATURA, "rb") as f:
        preview = client.post(
            "/api/upload",
            files={"file": ("fatura.pdf", f, "application/pdf")},
            data={"person": "diogo"},
            headers=auth(client),
        ).json()
    # Then confirm
    resp = client.post(
        "/api/upload/confirm",
        json={
            "file_id_temp": preview["file_id_temp"],
            "person": "diogo",
            "filename": "fatura.pdf",
            "file_type": "credit_card",
            "transactions": [
                {
                    "date": tx["date"],
                    "description": tx["description"],
                    "merchant_name": tx.get("merchant_name"),
                    "amount": tx["amount"],
                    "category_id": None,
                    "source": tx["source"],
                    "raw_text": tx.get("raw_text"),
                }
                for tx in preview["transactions"]
            ],
        },
        headers=auth(client),
    )
    assert resp.status_code == 200
    assert resp.json()["saved"] > 0


def test_upload_requires_auth(client):
    import os
    FATURA = os.path.join(os.path.dirname(__file__), "fixtures/fatura_sample.pdf")
    with open(FATURA, "rb") as f:
        resp = client.post(
            "/api/upload",
            files={"file": ("fatura.pdf", f, "application/pdf")},
            data={"person": "diogo"},
        )
    assert resp.status_code == 401
