const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('./auth');

// GET /api/inventory - Retrieve all inventory items (with optional search, category, lowStock filters)
router.get('/', authenticateToken, async (req, res) => {
  const { search, category, lowStock } = req.query;

  try {
    let sql = `
      SELECT i.*, u.full_name as creator_name 
      FROM inventory_items i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (i.name LIKE ? OR i.sku LIKE ? OR i.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (category && category !== 'All') {
      sql += ` AND i.category = ?`;
      params.push(category);
    }

    if (lowStock === 'true') {
      sql += ` AND i.quantity <= i.min_threshold`;
    }

    sql += ` ORDER BY i.id DESC`;

    const [items] = await pool.query(sql, params);
    res.json({ items });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
});

// GET /api/inventory/stats - Dashboard summary metrics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const [totalRows] = await pool.query('SELECT COUNT(*) as total_items, COALESCE(SUM(quantity), 0) as total_units, COALESCE(SUM(quantity * unit_price), 0) as total_valuation FROM inventory_items');
    const [lowStockRows] = await pool.query('SELECT COUNT(*) as low_stock_count FROM inventory_items WHERE quantity <= min_threshold');
    const [categoriesRows] = await pool.query('SELECT DISTINCT category FROM inventory_items WHERE category IS NOT NULL AND category != ""');

    // Today's total system transactions
    const [todayTxRows] = await pool.query('SELECT COUNT(*) as today_transactions FROM stock_transactions WHERE DATE(created_at) = CURDATE()');

    res.json({
      totalItems: totalRows[0].total_items,
      totalUnits: totalRows[0].total_units,
      totalValuation: parseFloat(totalRows[0].total_valuation || 0),
      lowStockCount: lowStockRows[0].low_stock_count,
      categories: categoriesRows.map(r => r.category),
      todayTransactions: todayTxRows[0].today_transactions
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to compute inventory statistics' });
  }
});

// POST /api/inventory - Create a new inventory item (Admin & User can create)
router.post('/', authenticateToken, async (req, res) => {
  const { sku, name, description, category, unit_price, quantity, min_threshold } = req.body;

  if (!sku || !name) {
    return res.status(400).json({ error: 'SKU and item name are required' });
  }

  const initialQty = parseInt(quantity) || 0;
  const price = parseFloat(unit_price) || 0.0;
  const threshold = parseInt(min_threshold) || 5;
  const itemCategory = category || 'General';

  try {
    // Check if SKU exists
    const [existing] = await pool.query('SELECT id FROM inventory_items WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Item with SKU "${sku}" already exists` });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory_items (sku, name, description, category, unit_price, quantity, min_threshold, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, description || '', itemCategory, price, initialQty, threshold, req.user.id]
    );

    const newItemId = result.insertId;

    // Log transaction
    await pool.query(
      `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES (?, ?, ?, ?, ?, 'CREATE', ?, 0, ?, ?)`,
      [newItemId, name, req.user.id, req.user.full_name || req.user.username, req.user.role, initialQty, initialQty, 'New item registered into catalog']
    );

    res.status(201).json({
      message: 'Item created successfully',
      item: {
        id: newItemId,
        sku,
        name,
        description,
        category: itemCategory,
        unit_price: price,
        quantity: initialQty,
        min_threshold: threshold
      }
    });
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// POST /api/inventory/:id/stock - Restock / Adjust stock quantity
router.post('/:id/stock', authenticateToken, async (req, res) => {
  const itemId = parseInt(req.params.id);
  const { action, amount, reason } = req.body; // action: 'add' (restock) or 'adjust' (set/deduct)

  const qtyAmount = parseInt(amount);
  if (isNaN(qtyAmount) || qtyAmount === 0) {
    return res.status(400).json({ error: 'Valid non-zero quantity amount is required' });
  }

  try {
    const [items] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const item = items[0];
    const prevQty = item.quantity;
    let newQty = 0;
    let type = 'RESTOCK';

    if (action === 'add') {
      if (qtyAmount < 0) {
        return res.status(400).json({ error: 'Restock amount must be positive' });
      }
      newQty = prevQty + qtyAmount;
      type = 'RESTOCK';
    } else if (action === 'adjust') {
      // adjust can be positive (found stock) or negative (damaged/sold)
      newQty = prevQty + qtyAmount;
      if (newQty < 0) {
        return res.status(400).json({ error: `Cannot deduct ${Math.abs(qtyAmount)} units. Current stock is only ${prevQty}.` });
      }
      type = 'ADJUSTMENT';
    } else {
      return res.status(400).json({ error: 'Invalid stock action. Use "add" or "adjust"' });
    }

    // Update item stock
    await pool.query('UPDATE inventory_items SET quantity = ?, updated_at = NOW() WHERE id = ?', [newQty, itemId]);

    // Record transaction
    const actionReason = reason || (action === 'add' ? `Restocked +${qtyAmount} units` : `Stock adjustment of ${qtyAmount > 0 ? '+' : ''}${qtyAmount} units`);
    await pool.query(
      `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, item.name, req.user.id, req.user.full_name || req.user.username, req.user.role, type, qtyAmount, prevQty, newQty, actionReason]
    );

    res.json({
      message: 'Stock updated successfully',
      item: { ...item, quantity: newQty },
      previousQuantity: prevQty,
      newQuantity: newQty,
      change: qtyAmount
    });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ error: 'Failed to update item stock' });
  }
});

// PUT /api/inventory/:id - Update item details
router.put('/:id', authenticateToken, async (req, res) => {
  const itemId = parseInt(req.params.id);
  const { sku, name, description, category, unit_price, min_threshold } = req.body;

  try {
    const [items] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const current = items[0];

    // Check unique SKU if changed
    if (sku && sku !== current.sku) {
      const [existing] = await pool.query('SELECT id FROM inventory_items WHERE sku = ? AND id != ?', [sku, itemId]);
      if (existing.length > 0) {
        return res.status(400).json({ error: `SKU "${sku}" is already in use by another item` });
      }
    }

    await pool.query(
      `UPDATE inventory_items SET 
        sku = COALESCE(?, sku),
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        unit_price = COALESCE(?, unit_price),
        min_threshold = COALESCE(?, min_threshold),
        updated_at = NOW()
       WHERE id = ?`,
      [sku, name, description, category, unit_price, min_threshold, itemId]
    );

    // Log update
    await pool.query(
      `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES (?, ?, ?, ?, ?, 'UPDATE', 0, ?, ?, ?)`,
      [itemId, name || current.name, req.user.id, req.user.full_name || req.user.username, req.user.role, current.quantity, current.quantity, 'Item details updated']
    );

    res.json({ message: 'Item details updated successfully' });
  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/inventory/:id - Delete item
router.delete('/:id', authenticateToken, async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const [items] = await pool.query('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = items[0];

    // Record delete transaction before deleting
    await pool.query(
      `INSERT INTO stock_transactions (item_id, item_name, user_id, user_name, user_role, transaction_type, quantity_change, previous_quantity, new_quantity, reason)
       VALUES (NULL, ?, ?, ?, ?, 'DELETE', ?, ?, 0, ?)`,
      [item.name, req.user.id, req.user.full_name || req.user.username, req.user.role, -item.quantity, item.quantity, `Item ${item.sku} deleted from inventory`]
    );

    await pool.query('DELETE FROM inventory_items WHERE id = ?', [itemId]);

    res.json({ message: `Item "${item.name}" (${item.sku}) deleted successfully` });
  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

module.exports = router;
