const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticateToken } = require('./auth');

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
};

// GET /api/users - List all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, full_name, email, role, status, created_at FROM users ORDER BY id ASC'
    );
    res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { username, password, full_name, email, role } = req.body;

  if (!username || !password || !full_name || !email) {
    return res.status(400).json({ error: 'All fields (username, password, full_name, email) are required' });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';

  try {
    // Check if username or email is taken
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    const [result] = await pool.query(
      'INSERT INTO users (username, password, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, "active")',
      [username, password, full_name, email, userRole]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        username,
        full_name,
        email,
        role: userRole,
        status: 'active'
      }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id/status - Toggle user status active/inactive (Admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  const { status } = req.body;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account' });
  }

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "inactive"' });
  }

  try {
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    res.json({ message: `User account status set to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;
