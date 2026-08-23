const express = require('express');
const router = express.Router();
const { pool: db } = require('../config/db');
const { requireAuth, requireAdmin } = require('./auth');

// GET /api/tickets/stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    let sql, params;
    if (req.user.role === 'admin') {
      sql = `
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END), 0) as approved,
          COALESCE(SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END), 0) as in_progress,
          COALESCE(SUM(CASE WHEN status='RESOLVED' THEN 1 ELSE 0 END), 0) as resolved,
          COALESCE(SUM(CASE WHEN priority='URGENT' AND status='PENDING' THEN 1 ELSE 0 END), 0) as urgent_pending
        FROM tickets
      `;
      params = [];
    } else {
      sql = `
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END), 0) as pending,
          COALESCE(SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END), 0) as approved,
          COALESCE(SUM(CASE WHEN status='IN_PROGRESS' THEN 1 ELSE 0 END), 0) as in_progress,
          COALESCE(SUM(CASE WHEN status='RESOLVED' THEN 1 ELSE 0 END), 0) as resolved,
          COALESCE(SUM(CASE WHEN priority='URGENT' AND status='PENDING' THEN 1 ELSE 0 END), 0) as urgent_pending
        FROM tickets WHERE user_id = ?
      `;
      params = [req.user.id];
    }
    const [rows] = await db.query(sql, params);
    const row = rows[0] || {};
    res.json({
      total: row.total || 0,
      pending: row.pending || 0,
      approved: row.approved || 0,
      inProgress: row.in_progress || 0,
      resolved: row.resolved || 0,
      urgentPending: row.urgent_pending || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tickets
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = 'SELECT * FROM tickets WHERE 1=1';
    const params = [];

    if (req.user.role !== 'admin') {
      sql += ' AND user_id = ?';
      params.push(req.user.id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND ticket_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ tickets: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tickets
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, ticket_type = 'STOCK_REQUEST', item_id, item_name, quantity_requested = 0, priority = 'MEDIUM', description } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    let finalItemName = item_name || '';
    if (item_id && !finalItemName) {
      const [it] = await db.query('SELECT name FROM inventory_items WHERE id = ?', [item_id]);
      if (it.length > 0) finalItemName = it[0].name;
    }

    const ticketNumber = `TCK-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const [userRows] = await db.query('SELECT full_name, email FROM users WHERE id = ?', [req.user.id]);
    const userName = userRows[0]?.full_name || req.user.username;
    const userEmail = userRows[0]?.email || `${req.user.username}@inventory.local`;

    const [result] = await db.query(
      `INSERT INTO tickets (ticket_number, user_id, user_name, user_email, title, ticket_type, item_id, item_name, quantity_requested, priority, status, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [ticketNumber, req.user.id, userName, userEmail, title, ticket_type, item_id || null, finalItemName || null, quantity_requested, priority, description]
    );

    // Audit log
    await db.query(
      `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES (?, ?, ?, ?, ?, 'UPDATE', 0, 0, 0, ?)`,
      [item_id || null, finalItemName || title, req.user.id, userName, req.user.role, `Raised Ticket ${ticketNumber}: ${title}`]
    );

    res.status(201).json({
      message: 'Ticket created successfully',
      ticket: {
        id: result.insertId,
        ticket_number: ticketNumber,
        title,
        status: 'PENDING'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tickets/:id/status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { status, admin_notes, deduct_stock } = req.body;

    const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (tickets.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = tickets[0];

    if ((status === 'APPROVED' || deduct_stock) && ticket.item_id && ticket.quantity_requested > 0) {
      const [items] = await db.query('SELECT quantity, name FROM inventory_items WHERE id = ?', [ticket.item_id]);
      if (items.length > 0) {
        const oldQty = items[0].quantity;
        const needed = ticket.quantity_requested;
        const newQty = Math.max(0, oldQty - needed);
        await db.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [newQty, ticket.item_id]);
        await db.query(
          `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
           VALUES (?, ?, ?, ?, ?, 'ADJUSTMENT', ?, ?, ?, ?)`,
          [ticket.item_id, items[0].name, req.user.id, req.user.full_name || req.user.username, req.user.role, -needed, oldQty, newQty, `Dispatched for approved ticket ${ticket.ticket_number}`]
        );
      }
    }

    await db.query(
      'UPDATE tickets SET status = ?, admin_notes = ?, resolved_by = ? WHERE id = ?',
      [status, admin_notes || ticket.admin_notes, req.user.full_name || req.user.username, ticketId]
    );

    res.json({
      message: `Ticket ${ticket.ticket_number} status updated to ${status}`,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
