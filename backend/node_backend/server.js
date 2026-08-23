const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { testConnection } = require('./config/db');
const { router: authRoutes } = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const usersRoutes = require('./routes/users');
const activityRoutes = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/activity', activityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), database: 'MySQL' });
});

// Start server and verify DB connection
app.listen(PORT, async () => {
  console.log(`🚀 Inventory Express API running on http://localhost:${PORT}`);
  await testConnection();
});
