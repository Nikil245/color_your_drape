require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

// Import routes
const authRoutes = require('./src/routes/auth');
const orderRoutes = require('./src/routes/orders');
const customerRoutes = require('./src/routes/customers');
const dashboardRoutes = require('./src/routes/dashboard');
const inventoryRoutes = require('./src/routes/inventory');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Headers ───
app.use(helmet());

// ─── CORS — allow the Vite dev server ───
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true, // required for httpOnly cookies
}));

// ─── Body Parsing ───
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);

// ─── Health Check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global Error Handler ───
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`✦ Colour Your Drape API running on http://localhost:${PORT}`);
});
