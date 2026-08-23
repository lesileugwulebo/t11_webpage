const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('./auth');

// GET /api/activity/today - Retrieve current user's activities for today ("what they have done for the day")
router.get('/today', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get today's logs for this user
    const [logs] = await pool.query(
      `SELECT * FROM stock_transactions 
       WHERE user_id = ? AND DATE(created_at) = CURDATE() 
       ORDER BY created_at DESC`,
      [userId]
    );

    // Compute today's summary metrics for the user
    let itemsCreatedToday = 0;
    let itemsRestockedToday = 0;
    let unitsAddedToday = 0;
    let adjustmentsToday = 0;
    let itemsDeletedToday = 0;

    logs.forEach(tx => {
      if (tx.transaction_type === 'CREATE') {
        itemsCreatedToday += 1;
        unitsAddedToday += (tx.quantity_change > 0 ? tx.quantity_change : 0);
      } else if (tx.transaction_type === 'RESTOCK') {
        itemsRestockedToday += 1;
        unitsAddedToday += tx.quantity_change;
      } else if (tx.transaction_type === 'ADJUSTMENT') {
        adjustmentsToday += 1;
      } else if (tx.transaction_type === 'DELETE') {
        itemsDeletedToday += 1;
      }
    });

    res.json({
      summary: {
        totalActionsToday: logs.length,
        itemsCreatedToday,
        itemsRestockedToday,
        unitsAddedToday,
        adjustmentsToday,
        itemsDeletedToday
      },
      logs
    });
  } catch (err) {
    console.error('Error fetching today activity:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s activity log' });
  }
});

// GET /api/activity/all - System-wide audit trail (Admin only)
router.get('/all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { limit = 50, offset = 0 } = req.query;

  try {
    const [logs] = await pool.query(
      `SELECT * FROM stock_transactions 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    const [countRows] = await pool.query('SELECT COUNT(*) as total FROM stock_transactions');

    res.json({
      total: countRows[0].total,
      logs
    });
  } catch (err) {
    console.error('Error fetching all activity:', err);
    res.status(500).json({ error: 'Failed to fetch activity audit trail' });
  }
});

module.exports = router;
