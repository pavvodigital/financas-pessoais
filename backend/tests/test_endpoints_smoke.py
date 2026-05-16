def get_token(client):
    return client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]

def auth(client):
    return {"Authorization": f"Bearer {get_token(client)}"}

def test_list_categories_empty(client):
    resp = client.get("/api/categories", headers=auth(client))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_list_transactions_empty(client):
    resp = client.get("/api/transactions", headers=auth(client))
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and "items" in data

def test_list_plans_empty(client):
    resp = client.get("/api/plans", headers=auth(client))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_trends_category_empty(client):
    resp = client.get("/api/trends?months=3", headers=auth(client))
    assert resp.status_code == 200

def test_trends_merchant_empty(client):
    resp = client.get("/api/trends/merchant?q=Uber&months=3", headers=auth(client))
    assert resp.status_code == 200

def test_create_transaction(client):
    resp = client.post("/api/transactions", json={
        "date": "2026-05-15",
        "description": "Test",
        "amount": -50.0,
        "person": "diogo",
        "source": "manual",
    }, headers=auth(client))
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == -50.0

def test_create_plan(client):
    resp = client.post("/api/plans", json={
        "name": "Test Plan",
        "goal_amount": 5000.0,
        "target_date": "2027-12-31",
        "category_budgets": [],
    }, headers=auth(client))
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Plan"
