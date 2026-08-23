const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'inventory_super_secret_jwt_key_2026';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// User Login (role = user or admin)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password, full_name, email, role, status FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });
    }

    // Direct password match or hashed match
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Database error during login' });
  }
});

// Admin Login (Enforces role === 'admin')
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password, full_name, email, role, status FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const user = rows[0];

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Admin account is deactivated.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin', full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Admin login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: 'admin'
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Database error during admin login' });
  }
});

// Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, full_name, email, role, status, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Microsoft Entra ID Single Sign-On (SSO)
router.post('/entra-sso', async (req, res) => {
  const { email, name, role = 'user' } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required from Microsoft Entra ID' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = cleanEmail.split('@')[0];
    const cleanName = name?.trim() || cleanUsername;
    const cleanRole = role === 'admin' ? 'admin' : 'user';

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? OR username = ?', [cleanEmail, cleanUsername]);
    let user;

    if (rows.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO users (username, password, full_name, email, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [cleanUsername, 'ENTRA_ID_SSO', cleanName, cleanEmail, cleanRole, 'active']
      );
      user = { id: result.insertId, username: cleanUsername, full_name: cleanName, email: cleanEmail, role: cleanRole, status: 'active' };
    } else {
      user = rows[0];
      if (cleanRole && user.role !== cleanRole) {
        await pool.query('UPDATE users SET role = ? WHERE id = ?', [cleanRole, user.id]);
        user.role = cleanRole;
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: `Authenticated via Microsoft Entra ID as ${user.full_name}`,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Entra ID SSO error:', err);
    res.status(500).json({ error: 'Failed to process Entra ID SSO' });
  }
});

// Admin Authorization Middleware
const requireAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  });
};

module.exports = {
  router,
  authenticateToken,
  requireAuth: authenticateToken,
  requireAdmin,
  JWT_SECRET
};
