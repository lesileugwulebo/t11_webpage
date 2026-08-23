import urllib.request
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE = "http://localhost:5000/api"

def api_call(path, method="GET", data=None, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def run_tests():
    print("--- 1. Health Check ---")
    status, res = api_call("/health")
    assert status == 200, f"Health check failed: {res}"
    print("Health OK:", res)

    print("--- 2. User Login ---")
    status, res = api_call("/auth/login", method="POST", data={"username": "user", "password": "user123"})
    assert status == 200, f"User login failed: {res}"
    user_token = res["token"]
    print("User Login OK, Token obtained:", user_token[:15] + "...")

    print("--- 3. Admin Login ---")
    status, res = api_call("/auth/admin-login", method="POST", data={"username": "admin", "password": "admin123"})
    assert status == 200, f"Admin login failed: {res}"
    admin_token = res["token"]
    print("Admin Login OK, Role:", res["user"]["role"])

    print("--- 4. Inventory List & Stats ---")
    status, res = api_call("/inventory", token=user_token)
    assert status == 200 and len(res["items"]) > 0, f"Get inventory failed: {res}"
    print(f"Inventory OK: Found {len(res['items'])} items")

    status, stats = api_call("/inventory/stats", token=admin_token)
    assert status == 200, f"Get stats failed: {stats}"
    print("Inventory Stats:", stats)

    import time
    test_sku = f"TEST-SKU-{int(time.time())}"
    print(f"--- 5. Create New Item ({test_sku}) ---")
    new_item_data = {
        "sku": test_sku,
        "name": "Automated Test Item",
        "description": "Item created during integration test",
        "category": "Electronics",
        "unit_price": 49.99,
        "quantity": 20,
        "min_threshold": 5
    }
    status, res = api_call("/inventory", method="POST", data=new_item_data, token=user_token)
    assert status == 201, f"Create item failed: {res}"
    item_id = res["item"]["id"]
    print("Created Item ID:", item_id)

    print("--- 6. Restock & Adjust Item ---")
    status, res = api_call(f"/inventory/{item_id}/stock", method="POST", data={"action": "add", "amount": 10, "reason": "Test Restock"}, token=user_token)
    assert status == 200 and res["newQuantity"] == 30, f"Restock failed: {res}"
    print(f"Restock OK: 20 -> {res['newQuantity']}")

    status, res = api_call(f"/inventory/{item_id}/stock", method="POST", data={"action": "adjust", "amount": -5, "reason": "Test Adjustment Sale"}, token=user_token)
    assert status == 200 and res["newQuantity"] == 25, f"Adjust failed: {res}"
    print(f"Adjust OK: 30 -> {res['newQuantity']}")

    print("--- 7. Verify Today's Activity Summary for User ---")
    status, res = api_call("/activity/today", token=user_token)
    assert status == 200, f"Today activity failed: {res}"
    print("User Today Summary:", res["summary"])
    assert res["summary"]["totalActionsToday"] >= 3, "Expected at least 3 actions today"

    print("--- 8. Admin User Provisioning ---")
    ts = int(time.time())
    new_user = {
        "username": f"test_user_{ts}",
        "password": "password123",
        "full_name": "Test Operator",
        "email": f"test_op_{ts}@inventory.local",
        "role": "user"
    }
    status, res = api_call("/users", method="POST", data=new_user, token=admin_token)
    assert status == 201, f"Create user failed: {res}"
    print("Admin User Creation OK:", res["user"])

    print("--- 9. Delete Test Item ---")
    status, res = api_call(f"/inventory/{item_id}", method="DELETE", token=user_token)
    assert status == 200, f"Delete failed: {res}"
    print("Delete Item OK:", res["message"])

    # 10. Microsoft Entra ID Single Sign-On (SSO)
    print("\n--- 10. Microsoft Entra ID SSO Authentication ---")
    entra_payload = {
        "email": "alex.morgan@verdadsolutions.com",
        "name": "Alex Morgan",
        "role": "user"
    }
    status, res = api_call("/auth/entra-sso", method="POST", data=entra_payload)
    assert status == 200, f"Entra ID SSO failed: {res}"
    entra_token = res["token"]
    print(f"Entra ID SSO OK: {res['message']} (User: {res['user']['username']})")

    # 11. Create Support / Stock Request Ticket
    print("\n--- 11. Create Stock Requisition Ticket ---")
    ticket_payload = {
        "title": "Automated Test Hardware Requisition",
        "ticket_type": "STOCK_REQUEST",
        "item_id": 1,
        "quantity_requested": 1,
        "priority": "HIGH",
        "description": "Auto test equipment requisition"
    }
    status, res = api_call("/tickets", method="POST", data=ticket_payload, token=entra_token)
    assert status == 201, f"Ticket creation failed: {res}"
    ticket_id = res["ticket"]["id"]
    print(f"Ticket Created OK: #{ticket_id} ({res['ticket']['ticket_number']}) - Status: {res['ticket']['status']}")

    # 12. Admin Ticket Stats & List
    print("\n--- 12. Admin Ticket Stats & Queue ---")
    status, res = api_call("/tickets/stats", token=admin_token)
    assert status == 200, f"Ticket stats failed: {res}"
    print("Ticket Stats OK:", res)

    status, res = api_call("/tickets", token=admin_token)
    assert status == 200, f"Ticket list failed: {res}"
    assert len(res["tickets"]) > 0, "No tickets returned"
    print(f"Ticket List OK: Found {len(res['tickets'])} tickets in queue")

    # 13. Admin Approve & Auto-Deduct Ticket
    print("\n--- 13. Admin Approve Ticket with Stock Deduction ---")
    status, res = api_call(f"/tickets/{ticket_id}/status", method="PATCH", data={
        "status": "APPROVED",
        "admin_notes": "Approved in automated test suite",
        "deduct_stock": True
    }, token=admin_token)
    assert status == 200, f"Ticket approval failed: {res}"
    print("Ticket Status Update OK:", res["message"])

    print("\nALL 13 INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟")

if __name__ == "__main__":
    run_tests()
