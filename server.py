import http.server
import socketserver
import json
import sqlite3
import os
import re
import random
import urllib.parse
from datetime import datetime, date

PORT = 5000
DB_FILE = os.path.join(os.path.dirname(__file__), "inventory.db")
STATIC_DIR = os.path.join(os.path.dirname(__file__), "frontend")

# -----------------------------------------------------------------------------
# Database Setup and Auto-migration
# -----------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Inventory Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL DEFAULT 'General',
        unit_price REAL NOT NULL DEFAULT 0.00,
        quantity INTEGER NOT NULL DEFAULT 0,
        min_threshold INTEGER NOT NULL DEFAULT 5,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    )
    """)

    # Stock Transactions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        item_name TEXT NOT NULL,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity_change INTEGER NOT NULL DEFAULT 0,
        previous_quantity INTEGER NOT NULL DEFAULT 0,
        new_quantity INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Seed Default Users if empty
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()['count'] == 0:
        users_seed = [
            ('admin', 'admin123', 'System Administrator', 'admin@inventory.local', 'admin', 'active'),
            ('user', 'user123', 'Warehouse Operator', 'user@inventory.local', 'user', 'active'),
            ('sarah_tech', 'user123', 'Sarah Jenkins', 'sarah@inventory.local', 'user', 'active')
        ]
        cursor.executemany("""
        INSERT INTO users (username, password, full_name, email, role, status)
        VALUES (?, ?, ?, ?, ?, ?)
        """, users_seed)

    # Seed Default Inventory Items if empty
    cursor.execute("SELECT COUNT(*) as count FROM inventory_items")
    if cursor.fetchone()['count'] == 0:
        items_seed = [
            ('ELEC-MBP-14', 'MacBook Pro 14" M3', '16GB RAM, 512GB SSD Space Gray', 'Electronics', 1999000.00, 24, 5, 1),
            ('ELEC-DELL-27', 'Dell UltraSharp 27" 4K Monitor', 'IPS USB-C Hub Monitor (U2723QE)', 'Electronics', 589500.00, 18, 4, 1),
            ('PERI-MXM-3S', 'Logitech MX Master 3S', 'Performance Wireless Mouse with Quiet Clicks', 'Peripherals', 99900.00, 45, 10, 1),
            ('PERI-KEY-MX', 'Logitech MX Mechanical Keyboard', 'Wireless Illuminated Keyboard Tactile Quiet', 'Peripherals', 149900.00, 3, 5, 1),
            ('FURN-CHR-ERG', 'Ergonomic Mesh Office Chair', 'High back with adjustable lumbar and 3D armrests', 'Furniture', 320000.00, 12, 3, 1),
            ('FURN-DSK-STD', 'Motorized Standing Desk 60x30', 'Dual motor height adjustable frame with oak top', 'Furniture', 450000.00, 2, 4, 1),
            ('STAT-NOT-A5', 'Premium Hardcover Notebook A5', '120gsm dotted grid acid-free paper', 'Stationery', 14500.00, 150, 20, 2),
            ('STAT-PEN-GEL', 'Pilot G2 0.7mm Gel Pens (Pack of 12)', 'Smooth writing black ink rollerball', 'Stationery', 18000.00, 68, 15, 2)
        ]
        cursor.executemany("""
        INSERT INTO inventory_items (sku, name, description, category, unit_price, quantity, min_threshold, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, items_seed)

        # Seed initial transaction logs
        tx_seed = [
            (1, 'MacBook Pro 14" M3', 1, 'System Administrator', 'admin', 'CREATE', 24, 0, 24, 'Initial stock setup'),
            (2, 'Dell UltraSharp 27" 4K Monitor', 1, 'System Administrator', 'admin', 'CREATE', 18, 0, 18, 'Initial stock setup'),
            (3, 'Logitech MX Master 3S', 1, 'System Administrator', 'admin', 'CREATE', 45, 0, 45, 'Initial stock setup'),
            (4, 'Logitech MX Mechanical Keyboard', 2, 'Warehouse Operator', 'user', 'RESTOCK', 10, 0, 10, 'Supplier delivery received'),
            (4, 'Logitech MX Mechanical Keyboard', 2, 'Warehouse Operator', 'user', 'ADJUSTMENT', -7, 10, 3, 'Dispatched for new hires'),
            (7, 'Premium Hardcover Notebook A5', 2, 'Warehouse Operator', 'user', 'CREATE', 150, 0, 150, 'Stationery restock')
        ]
        cursor.executemany("""
        INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, tx_seed)

    # 4. IT Support & Stock Requisition Tickets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        title TEXT NOT NULL,
        ticket_type TEXT NOT NULL DEFAULT 'STOCK_REQUEST',
        item_id INTEGER,
        item_name TEXT,
        quantity_requested INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        status TEXT NOT NULL DEFAULT 'PENDING',
        description TEXT NOT NULL,
        admin_notes TEXT,
        resolved_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cursor.execute("SELECT COUNT(*) as count FROM tickets")
    if cursor.fetchone()['count'] == 0:
        tickets_seed = [
            ('TCK-20260823-001', 2, 'Warehouse Operator', 'user@inventory.local', 'Request 1x MacBook Pro 14" M3 for New Engineering Hire', 'STOCK_REQUEST', 1, 'MacBook Pro 14" M3', 1, 'HIGH', 'PENDING', 'Hardware provision needed for incoming senior software engineer joining next Monday.', None, None),
            ('TCK-20260823-002', 3, 'Sarah Jenkins', 'sarah@inventory.local', 'Report Damaged Office Ergonomic Chair', 'DAMAGE_REPORT', 5, 'Ergonomic Mesh Office Chair', 1, 'MEDIUM', 'APPROVED', 'Hydraulic cylinder leaking oil and failing to hold height adjustment.', 'Replacement chair approved from warehouse storage.', 'System Administrator'),
            ('TCK-20260823-003', 2, 'Warehouse Operator', 'user@inventory.local', 'Low Stock Alert: Logitech Mechanical Keyboards', 'STOCK_REQUEST', 4, 'Logitech MX Mechanical Keyboard', 10, 'URGENT', 'PENDING', 'Stock level is currently at 3 units, which is below the minimum threshold of 5 units. Reordering needed.', None, None)
        ]
        cursor.executemany("""
        INSERT INTO tickets (ticket_number, user_id, user_name, user_email, title, ticket_type, item_id, item_name, quantity_requested, priority, status, description, admin_notes, resolved_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, tickets_seed)

    conn.commit()
    conn.close()

# -----------------------------------------------------------------------------
# Simple Token Auth Utility (Token encoding/decoding)
# -----------------------------------------------------------------------------
import base64
import hmac
import hashlib

SECRET_KEY = b"inventory_management_system_secret_key_2026"

def generate_token(user_id, username, role, full_name):
    payload = {
        "id": user_id,
        "username": username,
        "role": role,
        "full_name": full_name,
        "exp": int(datetime.now().timestamp()) + 86400 * 7
    }
    payload_json = json.dumps(payload).encode('utf-8')
    sig = hmac.new(SECRET_KEY, payload_json, hashlib.sha256).hexdigest()
    token = f"{base64.b64encode(payload_json).decode('utf-8')}.{sig}"
    return token

def decode_token(token_str):
    if not token_str:
        return None
    try:
        parts = token_str.split('.')
        if len(parts) != 2:
            return None
        payload_json = base64.b64decode(parts[0])
        expected_sig = hmac.new(SECRET_KEY, payload_json, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_sig, parts[1]):
            return None
        payload = json.loads(payload_json.decode('utf-8'))
        if payload.get('exp', 0) < datetime.now().timestamp():
            return None
        return payload
    except Exception:
        return None

# -----------------------------------------------------------------------------
# HTTP Request Handler with REST API & Static React App Serving
# -----------------------------------------------------------------------------
class InventoryRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        token = auth_header.split(" ")[1]
        return decode_token(token)

    def read_json_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Health Check
        if path == "/api/health":
            return self.send_json(200, {"status": "healthy", "engine": "Inventory REST API", "database": "SQLite / MySQL Ready"})

        # Current Profile
        if path == "/api/auth/me":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})
            return self.send_json(200, {"user": user})

        # Inventory Stats
        if path == "/api/inventory/stats":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_units, COALESCE(SUM(quantity * unit_price), 0) as total_valuation FROM inventory_items")
            stats_row = cursor.fetchone()

            cursor.execute("SELECT COUNT(*) as low_stock_count FROM inventory_items WHERE quantity <= min_threshold")
            low_stock_row = cursor.fetchone()

            cursor.execute("SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL AND category != ''")
            cats = [row['category'] for row in cursor.fetchall()]

            cursor.execute("SELECT COUNT(*) as today_transactions FROM stock_transactions WHERE date(created_at) = date('now')")
            today_tx = cursor.fetchone()['today_transactions']
            conn.close()

            return self.send_json(200, {
                "totalItems": stats_row['total_items'],
                "totalUnits": stats_row['total_units'],
                "totalValuation": round(stats_row['total_valuation'], 2),
                "lowStockCount": low_stock_row['low_stock_count'],
                "categories": cats,
                "todayTransactions": today_tx
            })

        # Inventory List
        if path == "/api/inventory":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            search = query.get("search", [""])[0]
            category = query.get("category", [""])[0]
            low_stock = query.get("lowStock", ["false"])[0]

            conn = get_db()
            cursor = conn.cursor()
            sql = """
                SELECT i.*, u.full_name as creator_name 
                FROM inventory_items i
                LEFT JOIN users u ON i.created_by = u.id
                WHERE 1=1
            """
            params = []

            if search:
                sql += " AND (i.name LIKE ? OR i.sku LIKE ? OR i.description LIKE ?)"
                term = f"%{search}%"
                params.extend([term, term, term])

            if category and category != "All":
                sql += " AND i.category = ?"
                params.append(category)

            if low_stock.lower() == "true":
                sql += " AND i.quantity <= i.min_threshold"

            sql += " ORDER BY i.id DESC"

            cursor.execute(sql, params)
            items = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {"items": items})

        # Users List (Admin Only)
        if path == "/api/users":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "Administrator privilege required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, full_name, email, role, status, created_at FROM users ORDER BY id ASC")
            users = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {"users": users})

        # User Today's Activity ("what they have done for the day")
        if path == "/api/activity/today":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM stock_transactions 
                WHERE user_id = ? AND date(created_at) = date('now') 
                ORDER BY created_at DESC
            """, (user['id'],))
            logs = [dict(row) for row in cursor.fetchall()]
            conn.close()

            items_created = sum(1 for l in logs if l['transaction_type'] == 'CREATE')
            items_restocked = sum(1 for l in logs if l['transaction_type'] == 'RESTOCK')
            units_added = sum(l['quantity_change'] for l in logs if l['transaction_type'] in ('CREATE', 'RESTOCK') and l['quantity_change'] > 0)
            adjustments = sum(1 for l in logs if l['transaction_type'] == 'ADJUSTMENT')
            items_deleted = sum(1 for l in logs if l['transaction_type'] == 'DELETE')

            return self.send_json(200, {
                "summary": {
                    "totalActionsToday": len(logs),
                    "itemsCreatedToday": items_created,
                    "itemsRestockedToday": items_restocked,
                    "unitsAddedToday": units_added,
                    "adjustmentsToday": adjustments,
                    "itemsDeletedToday": items_deleted
                },
                "logs": logs
            })

        # All Activities Audit Trail (Admin Only)
        if path == "/api/activity/all":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "Administrator privilege required"})

            limit = int(query.get("limit", [50])[0])
            offset = int(query.get("offset", [0])[0])

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM stock_transactions ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
            logs = [dict(row) for row in cursor.fetchall()]
            cursor.execute("SELECT COUNT(*) as total FROM stock_transactions")
            total = cursor.fetchone()['total']
            conn.close()

            return self.send_json(200, {"total": total, "logs": logs})

        # Ticket Metrics / Stats
        if path == "/api/tickets/stats":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})
            conn = get_db()
            cursor = conn.cursor()
            if user['role'] == 'admin':
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total, 
                        COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END), 0) as pending,
                        COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END), 0) as approved,
                        COALESCE(SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END), 0) as in_progress,
                        COALESCE(SUM(CASE WHEN status='RESOLVED' THEN 1 ELSE 0 END), 0) as resolved,
                        COALESCE(SUM(CASE WHEN priority='URGENT' AND status='PENDING' THEN 1 ELSE 0 END), 0) as urgent_pending
                    FROM tickets
                """)
            else:
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total, 
                        COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END), 0) as pending,
                        COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END), 0) as approved,
                        COALESCE(SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END), 0) as in_progress,
                        COALESCE(SUM(CASE WHEN status='RESOLVED' THEN 1 ELSE 0 END), 0) as resolved,
                        COALESCE(SUM(CASE WHEN priority='URGENT' AND status='PENDING' THEN 1 ELSE 0 END), 0) as urgent_pending
                    FROM tickets WHERE user_id = ?
                """, (user['id'],))
            row = cursor.fetchone()
            conn.close()
            return self.send_json(200, {
                "total": row['total'],
                "pending": row['pending'],
                "approved": row['approved'],
                "inProgress": row['in_progress'],
                "resolved": row['resolved'],
                "urgentPending": row['urgent_pending']
            })

        # Tickets List (User sees own; Admin sees all)
        if path == "/api/tickets":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})
            status_filter = query.get("status", [""])[0]
            type_filter = query.get("type", [""])[0]

            conn = get_db()
            cursor = conn.cursor()
            sql = "SELECT * FROM tickets WHERE 1=1"
            params = []
            if user['role'] != 'admin':
                sql += " AND user_id = ?"
                params.append(user['id'])
            if status_filter:
                sql += " AND status = ?"
                params.append(status_filter)
            if type_filter:
                sql += " AND ticket_type = ?"
                params.append(type_filter)
            sql += " ORDER BY created_at DESC"
            cursor.execute(sql, tuple(params))
            tickets = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return self.send_json(200, {"tickets": tickets})

        # Serve Frontend Static Files
        if path == "/" or not os.path.exists(os.path.join(STATIC_DIR, path.lstrip("/"))):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Entra ID Single Sign-On Endpoint
        if path == "/api/auth/entra-sso":
            data = self.read_json_body()
            email = data.get("email", "").strip().lower()
            name = data.get("name", "").strip() or email.split("@")[0]
            role = data.get("role", "user").strip().lower()

            if not email:
                return self.send_json(400, {"error": "Email is required from Microsoft Entra ID"})

            conn = get_db()
            cursor = conn.cursor()
            username = email.split("@")[0]
            cursor.execute("SELECT id, username, full_name, email, role, status FROM users WHERE email = ? OR username = ?", (email, username))
            user = cursor.fetchone()

            if not user:
                # Auto-provision user in database
                cursor.execute("""
                    INSERT INTO users (username, password, full_name, email, role, status)
                    VALUES (?, ?, ?, ?, ?, 'active')
                """, (username, 'ENTRA_ID_SSO', name, email, role))
                conn.commit()
                new_id = cursor.lastrowid
                user_obj = {
                    "id": new_id,
                    "username": username,
                    "full_name": name,
                    "email": email,
                    "role": role,
                    "status": "active"
                }
            else:
                user_obj = dict(user)
                if role in ('admin', 'user') and user_obj['role'] != role:
                    cursor.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_obj['id']))
                    conn.commit()
                    user_obj['role'] = role

            conn.close()
            token = generate_token(user_obj['id'], user_obj['username'], user_obj['role'], user_obj['full_name'])
            return self.send_json(200, {
                "message": f"Authenticated via Microsoft Entra ID as {user_obj['full_name']}",
                "token": token,
                "user": {
                    "id": user_obj['id'],
                    "username": user_obj['username'],
                    "full_name": user_obj['full_name'],
                    "email": user_obj['email'],
                    "role": user_obj['role']
                }
            })

        # 1. User Login
        if path == "/api/auth/login":
            data = self.read_json_body()
            username = data.get("username", "").strip()
            password = data.get("password", "").strip()

            if not username or not password:
                return self.send_json(400, {"error": "Username and password are required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, password, full_name, email, role, status FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            conn.close()

            if not user or user['password'] != password:
                return self.send_json(401, {"error": "Invalid username or password"})

            if user['status'] != 'active':
                return self.send_json(403, {"error": "Account is deactivated. Contact admin."})

            token = generate_token(user['id'], user['username'], user['role'], user['full_name'])
            return self.send_json(200, {
                "message": "Login successful",
                "token": token,
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "full_name": user['full_name'],
                    "email": user['email'],
                    "role": user['role']
                }
            })

        # 2. Admin Login
        if path == "/api/auth/admin-login":
            data = self.read_json_body()
            username = data.get("username", "").strip()
            password = data.get("password", "").strip()

            if not username or not password:
                return self.send_json(400, {"error": "Username and password are required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, password, full_name, email, role, status FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            conn.close()

            if not user or user['password'] != password:
                return self.send_json(401, {"error": "Invalid admin credentials"})

            if user['role'] != 'admin':
                return self.send_json(403, {"error": "Access denied. Administrator privileges required."})

            if user['status'] != 'active':
                return self.send_json(403, {"error": "Admin account is deactivated."})

            token = generate_token(user['id'], user['username'], 'admin', user['full_name'])
            return self.send_json(200, {
                "message": "Admin login successful",
                "token": token,
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "full_name": user['full_name'],
                    "email": user['email'],
                    "role": 'admin'
                }
            })

        # 3. Create Item (Inventory)
        if path == "/api/inventory":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            data = self.read_json_body()
            sku = data.get("sku", "").strip().upper()
            name = data.get("name", "").strip()
            description = data.get("description", "").strip()
            category = data.get("category", "General").strip() or "General"
            unit_price = float(data.get("unit_price", 0.0) or 0.0)
            quantity = int(data.get("quantity", 0) or 0)
            min_threshold = int(data.get("min_threshold", 5) or 5)

            if not sku or not name:
                return self.send_json(400, {"error": "SKU and item name are required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM inventory_items WHERE sku = ?", (sku,))
            if cursor.fetchone():
                conn.close()
                return self.send_json(400, {"error": f"Item with SKU '{sku}' already exists"})

            cursor.execute("""
                INSERT INTO inventory_items (sku, name, description, category, unit_price, quantity, min_threshold, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (sku, name, description, category, unit_price, quantity, min_threshold, user['id']))
            new_item_id = cursor.lastrowid

            # Log transaction
            cursor.execute("""
                INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                VALUES (?, ?, ?, ?, ?, 'CREATE', ?, 0, ?, ?)
            """, (new_item_id, name, user['id'], user.get('full_name', user['username']), user['role'], quantity, quantity, "New item registered into catalog"))

            conn.commit()
            conn.close()

            return self.send_json(201, {
                "message": "Item created successfully",
                "item": {
                    "id": new_item_id,
                    "sku": sku,
                    "name": name,
                    "description": description,
                    "category": category,
                    "unit_price": unit_price,
                    "quantity": quantity,
                    "min_threshold": min_threshold
                }
            })

        # 4. Stock Restock / Adjustment: /api/inventory/<id>/stock
        stock_match = re.match(r"^/api/inventory/(\d+)/stock$", path)
        if stock_match:
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            item_id = int(stock_match.group(1))
            data = self.read_json_body()
            action = data.get("action", "add") # "add" or "adjust"
            amount = int(data.get("amount", 0))
            reason = data.get("reason", "").strip()

            if amount == 0:
                return self.send_json(400, {"error": "Quantity change amount cannot be zero"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM inventory_items WHERE id = ?", (item_id,))
            item = cursor.fetchone()
            if not item:
                conn.close()
                return self.send_json(404, {"error": "Item not found"})

            prev_qty = item['quantity']
            new_qty = 0
            tx_type = 'RESTOCK'

            if action == 'add':
                if amount < 0:
                    conn.close()
                    return self.send_json(400, {"error": "Restock amount must be a positive number"})
                new_qty = prev_qty + amount
                tx_type = 'RESTOCK'
                default_reason = f"Restocked +{amount} units"
            elif action == 'adjust':
                new_qty = prev_qty + amount
                if new_qty < 0:
                    conn.close()
                    return self.send_json(400, {"error": f"Cannot deduct {abs(amount)} units. Current stock is {prev_qty}."})
                tx_type = 'ADJUSTMENT'
                default_reason = f"Stock adjustment of {'+' if amount > 0 else ''}{amount} units"
            else:
                conn.close()
                return self.send_json(400, {"error": "Action must be 'add' or 'adjust'"})

            cursor.execute("UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_qty, item_id))

            cursor.execute("""
                INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (item_id, item['name'], user['id'], user.get('full_name', user['username']), user['role'], tx_type, amount, prev_qty, new_qty, reason or default_reason))

            conn.commit()
            conn.close()

            return self.send_json(200, {
                "message": "Stock updated successfully",
                "previousQuantity": prev_qty,
                "newQuantity": new_qty,
                "change": amount
            })

        # 5. Create User (Admin Only)
        if path == "/api/users":
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "Administrator privilege required"})

            data = self.read_json_body()
            username = data.get("username", "").strip()
            password = data.get("password", "").strip()
            full_name = data.get("full_name", "").strip()
            email = data.get("email", "").strip()
            role = data.get("role", "user").strip().lower()
            if role not in ('admin', 'user'):
                role = 'user'

            if not username or not password or not full_name or not email:
                return self.send_json(400, {"error": "Username, password, full name, and email are required"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
            if cursor.fetchone():
                conn.close()
                return self.send_json(400, {"error": "Username or email already exists"})

            cursor.execute("""
                INSERT INTO users (username, password, full_name, email, role, status)
                VALUES (?, ?, ?, ?, ?, 'active')
            """, (username, password, full_name, email, role))
            new_user_id = cursor.lastrowid
            conn.commit()
            conn.close()

            return self.send_json(201, {
                "message": "User account created successfully",
                "user": {
                    "id": new_user_id,
                    "username": username,
                    "full_name": full_name,
                    "email": email,
                    "role": role,
                    "status": "active"
                }
            })

        # 6. Create Support / Stock Requisition Ticket
        if path == "/api/tickets":
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            data = self.read_json_body()
            title = data.get("title", "").strip()
            ticket_type = data.get("ticket_type", "STOCK_REQUEST").strip().upper()
            item_id = data.get("item_id")
            item_name = data.get("item_name", "").strip()
            quantity = int(data.get("quantity_requested", 0) or 0)
            priority = data.get("priority", "MEDIUM").strip().upper()
            description = data.get("description", "").strip()

            if not title or not description:
                return self.send_json(400, {"error": "Title and description are required"})

            valid_types = ('STOCK_REQUEST', 'DAMAGE_REPORT', 'MAINTENANCE', 'GENERAL_SUPPORT')
            if ticket_type not in valid_types:
                ticket_type = 'STOCK_REQUEST'

            valid_priorities = ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
            if priority not in valid_priorities:
                priority = 'MEDIUM'

            conn = get_db()
            cursor = conn.cursor()

            # Lookup item name if item_id provided and item_name blank
            if item_id and not item_name:
                cursor.execute("SELECT name FROM inventory_items WHERE id = ?", (item_id,))
                it = cursor.fetchone()
                if it:
                    item_name = it['name']

            cursor.execute("SELECT email, full_name FROM users WHERE id = ?", (user['id'],))
            u_row = cursor.fetchone()
            user_email = u_row['email'] if u_row else f"{user['username']}@inventory.local"
            user_name = u_row['full_name'] if u_row else user['full_name']

            ticket_number = f"TCK-{int(datetime.now().timestamp())}-{random.randint(100, 999)}"

            cursor.execute("""
                INSERT INTO tickets (ticket_number, user_id, user_name, user_email, title, ticket_type, item_id, item_name, quantity_requested, priority, status, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
            """, (ticket_number, user['id'], user_name, user_email, title, ticket_type, item_id, item_name, quantity, priority, description))
            new_ticket_id = cursor.lastrowid

            # Log audit event
            cursor.execute("""
                INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                VALUES (?, ?, ?, ?, ?, 'UPDATE', 0, 0, 0, ?)
            """, (item_id or 0, item_name or title, user['id'], user_name, user['role'], f"Raised Ticket {ticket_number}: {title}"))

            conn.commit()
            conn.close()

            return self.send_json(201, {
                "message": "Ticket created successfully",
                "ticket": {
                    "id": new_ticket_id,
                    "ticket_number": ticket_number,
                    "title": title,
                    "status": "PENDING"
                }
            })

        return self.send_json(404, {"error": "Endpoint not found"})

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Update Item: /api/inventory/<id>
        item_match = re.match(r"^/api/inventory/(\d+)$", path)
        if item_match:
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            item_id = int(item_match.group(1))
            data = self.read_json_body()
            sku = data.get("sku", "").strip().upper()
            name = data.get("name", "").strip()
            description = data.get("description", "").strip()
            category = data.get("category", "General").strip()
            unit_price = float(data.get("unit_price", 0.0) or 0.0)
            min_threshold = int(data.get("min_threshold", 5) or 5)

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM inventory_items WHERE id = ?", (item_id,))
            item = cursor.fetchone()
            if not item:
                conn.close()
                return self.send_json(404, {"error": "Item not found"})

            if sku and sku != item['sku']:
                cursor.execute("SELECT id FROM inventory_items WHERE sku = ? AND id != ?", (sku, item_id))
                if cursor.fetchone():
                    conn.close()
                    return self.send_json(400, {"error": f"SKU '{sku}' is already assigned to another item"})

            cursor.execute("""
                UPDATE inventory_items 
                SET sku = ?, name = ?, description = ?, category = ?, unit_price = ?, min_threshold = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (sku or item['sku'], name or item['name'], description, category, unit_price, min_threshold, item_id))

            cursor.execute("""
                INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                VALUES (?, ?, ?, ?, ?, 'UPDATE', 0, ?, ?, 'Item details updated')
            """, (item_id, name or item['name'], user['id'], user.get('full_name', user['username']), user['role'], item['quantity'], item['quantity']))

            conn.commit()
            conn.close()
            return self.send_json(200, {"message": "Item updated successfully"})

        return self.send_json(404, {"error": "Endpoint not found"})

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Delete Item: /api/inventory/<id>
        item_match = re.match(r"^/api/inventory/(\d+)$", path)
        if item_match:
            user = self.get_auth_user()
            if not user:
                return self.send_json(401, {"error": "Authentication required"})

            item_id = int(item_match.group(1))
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM inventory_items WHERE id = ?", (item_id,))
            item = cursor.fetchone()
            if not item:
                conn.close()
                return self.send_json(404, {"error": "Item not found"})

            # Log deletion
            cursor.execute("""
                INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                VALUES (NULL, ?, ?, ?, ?, 'DELETE', ?, ?, 0, ?)
            """, (item['name'], user['id'], user.get('full_name', user['username']), user['role'], -item['quantity'], item['quantity'], f"Item {item['sku']} removed from inventory"))

            cursor.execute("DELETE FROM inventory_items WHERE id = ?", (item_id,))
            conn.commit()
            conn.close()

            return self.send_json(200, {"message": f"Item '{item['name']}' ({item['sku']}) deleted successfully"})

        return self.send_json(404, {"error": "Endpoint not found"})

    def do_PATCH(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Toggle User Status: /api/users/<id>/status
        user_match = re.match(r"^/api/users/(\d+)/status$", path)
        if user_match:
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "Administrator privilege required"})

            target_user_id = int(user_match.group(1))
            if target_user_id == user['id']:
                return self.send_json(400, {"error": "Cannot deactivate your own admin account"})

            data = self.read_json_body()
            status = data.get("status", "active")
            if status not in ('active', 'inactive'):
                return self.send_json(400, {"error": "Status must be 'active' or 'inactive'"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (status, target_user_id))
            conn.commit()
            conn.close()

            return self.send_json(200, {"message": f"User status set to {status}"})

        # Update Ticket Status: /api/tickets/<id>/status (Admin Only)
        ticket_match = re.match(r"^/api/tickets/(\d+)/status$", path)
        if ticket_match:
            user = self.get_auth_user()
            if not user or user.get("role") != "admin":
                return self.send_json(403, {"error": "Administrator privilege required to update ticket status"})

            ticket_id = int(ticket_match.group(1))
            data = self.read_json_body()
            new_status = data.get("status", "").strip().upper()
            admin_notes = data.get("admin_notes", "").strip()
            deduct_stock = data.get("deduct_stock", False)

            valid_statuses = ('PENDING', 'APPROVED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')
            if new_status not in valid_statuses:
                return self.send_json(400, {"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"})

            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
            ticket = cursor.fetchone()
            if not ticket:
                conn.close()
                return self.send_json(404, {"error": "Ticket not found"})

            # If APPROVED and deduct_stock requested & item_id present
            if (new_status == "APPROVED" or deduct_stock) and ticket['item_id'] and ticket['quantity_requested'] > 0:
                cursor.execute("SELECT quantity, name FROM inventory_items WHERE id = ?", (ticket['item_id'],))
                item = cursor.fetchone()
                if item:
                    old_qty = item['quantity']
                    needed = ticket['quantity_requested']
                    new_qty = max(0, old_qty - needed)
                    cursor.execute("UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_qty, ticket['item_id']))
                    cursor.execute("""
                        INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
                        VALUES (?, ?, ?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?)
                    """, (ticket['item_id'], item['name'], user['id'], user.get('full_name', user['username']), user['role'], -needed, old_qty, new_qty, f"Dispatched for approved ticket {ticket['ticket_number']}"))

            cursor.execute("""
                UPDATE tickets 
                SET status = ?, admin_notes = ?, resolved_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            """, (new_status, admin_notes or ticket['admin_notes'], user.get('full_name', user['username']), ticket_id))

            conn.commit()
            conn.close()

            return self.send_json(200, {
                "message": f"Ticket {ticket['ticket_number']} updated to {new_status}",
                "status": new_status
            })

        return self.send_json(404, {"error": "Endpoint not found"})


import sys

def run_server():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    init_db()
    print("=" * 65)
    print("  VERDAD SOLUTION INVENTORYAPP (REACT + FULL-STACK API)")
    print(f"  Application Server running at: http://localhost:{PORT}")
    print("  Default Admin Login : admin / admin123")
    print("  Default User Login  : user  / user123")
    print("  Database            : SQLite initialized (MySQL schema in /backend/schema.sql)")
    print("=" * 65)
    
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), InventoryRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
