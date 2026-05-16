def test_login_correct_password(client):
    resp = client.post("/api/auth/login", json={"password": "changeme"})
    assert resp.status_code == 200
    assert "token" in resp.json()

def test_login_wrong_password(client):
    resp = client.post("/api/auth/login", json={"password": "wrong"})
    assert resp.status_code == 401

def test_protected_endpoint_without_token(client):
    resp = client.get("/api/dashboard")
    assert resp.status_code == 401

def test_protected_endpoint_with_token(client):
    token = client.post("/api/auth/login", json={"password": "changeme"}).json()["token"]
    resp = client.get("/api/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
