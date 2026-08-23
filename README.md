# 📦 Verdad Solution InventoryApp

A full-stack Inventory Management Application built with **React** on the frontend and **MySQL** database backend with RESTful API architecture.

---

## 🌟 Key Features

### 👤 1. Dedicated User / Staff Portal (`/login`)
- **Today's Work Summary**: Real-time KPI metrics and timeline showing everything the user has done today (Units added, Restocks, Adjustments, Items Created, Items Deleted).
- **Inventory Stock View**: Browse all products with real-time stock levels, category filters, and search.
- **Stock Restock & Addition**: Quickly add stock to existing products with PO reference/notes.
- **Stock Adjustment & Deduction**: Adjust stock levels up or down (sales, damages, office usage, inventory audits) with mandatory reason logging.
- **Create New Items**: Register new products directly with SKU, price, and initial quantity.
- **Delete Items**: Safely remove products with automatic transaction audit logs.

### 🛡️ 2. Dedicated Administrator Portal (`/admin-login`)
- **Executive Metrics**: Total Products, Total Storage Units, Total Inventory Valuation, Low Stock Alerts, and Global Daily Actions.
- **Inventory Control**: Full catalog oversight, bulk restock, edit details, and deletion.
- **User Management**: Provision new staff or administrator accounts with roles, view active user lists, and toggle account activation status.
- **Global Audit Trail**: Chronological system-wide log of every action taken across all users and administrators.

---

## 🔐 Default Demo Accounts

| Role | Username | Password | Target Dashboard |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Admin Dashboard |
| **Staff User** | `user` | `user123` | User Dashboard ("Today's Work") |
| **Staff User 2** | `sarah_tech` | `user123` | User Dashboard ("Today's Work") |

---

## 🚀 How to Run the Application

### Option A: Instant Run (Zero Setup Required)
You can launch the entire application (Frontend + REST API + Auto-database) directly:

```powershell
# Double-click start_server.bat OR run in terminal:
& "C:\Program Files\Python314\python.exe" server.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

### Option B: Running with Node.js + MySQL

1. **Import Database Schema**:
   Open MySQL Workbench / phpMyAdmin / MySQL CLI and run:
   ```sql
   source backend/schema.sql;
   ```

2. **Configure Database Credentials**:
   In `backend/node_backend/`, create or edit `.env`:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=inventory_db
   DB_PORT=3306
   JWT_SECRET=inventory_super_secret_jwt_key_2026
   ```

3. **Install Dependencies & Run**:
   ```bash
   cd backend/node_backend
   npm install
   npm start
   ```

---

## 📁 Project Structure

```
miva_project/
├── backend/
│   ├── schema.sql              # MySQL DDL & Initial Seeds
│   ├── .env.example            # Sample environment file
│   └── node_backend/           # Express.js + MySQL Implementation
│       ├── package.json
│       ├── server.js           # Express API Server
│       ├── config/
│       │   └── db.js           # MySQL connection pool
│       └── routes/
│           ├── auth.js         # User & Admin Login endpoints
│           ├── inventory.js    # Stock CRUD & Restock/Adjust
│           ├── users.js        # User provisioning (Admin)
│           └── activity.js     # Today's user activity & Audit trail
├── frontend/                   # React Frontend Application
│   ├── index.html              # HTML5 entry with React 18 & Inter typography
│   ├── css/
│   │   ├── main.css            # Dark/light theme design tokens & layout
│   │   └── components.css      # Glassmorphism cards, tables, badges, modals, toasts
│   └── js/
│       ├── api.js              # API service client
│       ├── authContext.js      # React auth context & token storage
│       ├── components/
│       │   ├── Navbar.js       # Top navigation & role badges
│       │   ├── StatsCard.js    # Metric KPI cards
│       │   ├── InventoryTable.js # Reusable data table with search/filters
│       │   ├── Modals.js       # Add Stock, Adjust Stock, Create Item, Create User
│       │   ├── ActivityFeed.js # Daily timeline component
│       │   └── Toast.js        # Feedback toast notification system
│       ├── pages/
│       │   ├── UserLogin.js    # Dedicated User Login
│       │   ├── AdminLogin.js   # Dedicated Admin Login
│       │   ├── AdminDashboard.js # Admin Dashboard
│       │   └── UserDashboard.js  # User Dashboard ("Today's Work")
│       └── app.js              # React Root & Router
├── server.py                   # Unified full-stack server
├── start_server.bat            # Windows 1-click launcher
└── README.md
```
