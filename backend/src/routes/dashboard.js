const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/dashboard/summary
 * Returns calculated KPIs and chart data from real Firestore orders data.
 */
router.get('/summary', async (req, res) => {
  try {
    const snapshot = await db.collection('orders').get();
    const orders = [];
    snapshot.forEach((doc) => orders.push({ id: doc.id, ...doc.data() }));

    // ─── KPIs ───
    const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.profit || 0), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const pendingDeliveries = orders.filter(
      (o) => o.itemStatus && !['Delivered', 'Returned'].includes(o.itemStatus)
    ).length;

    // ─── Chart Data: Sales & Profit over time (Dynamic Time Series) ───
    let oldestDate = null;
    orders.forEach((o) => {
      const dateStr = o.orderPlacedDate || o.createdAt?.split('T')[0] || '';
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          if (!oldestDate || d < oldestDate) {
            oldestDate = d;
          }
        }
      }
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let isSameMonth = true;
    if (oldestDate) {
      if (oldestDate.getFullYear() < currentYear || oldestDate.getMonth() < currentMonth) {
        isSameMonth = false;
      }
    }

    const periodsList = [];
    const aggregated = {};

    if (isSameMonth) {
      // Show daily data for the current month
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const label = `${monthNamesShort[currentMonth]} ${d}`;
        periodsList.push({ key: dateStr, label });
        aggregated[dateStr] = { period: label, sales: 0, profit: 0 };
      }
      orders.forEach((o) => {
        const dateStr = o.orderPlacedDate || o.createdAt?.split('T')[0] || '';
        if (dateStr && aggregated[dateStr]) {
          aggregated[dateStr].sales += (o.totalAmount || 0);
          aggregated[dateStr].profit += (o.profit || 0);
        }
      });
    } else {
      // Show monthly data for the last 6-12 months
      const monthsDiff = (currentYear - oldestDate.getFullYear()) * 12 + (currentMonth - oldestDate.getMonth());
      const targetMonthsCount = monthsDiff >= 6 ? 12 : 6;
      
      for (let i = targetMonthsCount - 1; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const yyyyMm = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${monthNamesShort[m]} ${y}`;
        periodsList.push({ key: yyyyMm, label });
        aggregated[yyyyMm] = { period: label, sales: 0, profit: 0 };
      }
      orders.forEach((o) => {
        const dateStr = o.orderPlacedDate || o.createdAt?.split('T')[0] || '';
        if (dateStr) {
          const yyyyMm = dateStr.substring(0, 7); // YYYY-MM
          if (aggregated[yyyyMm]) {
            aggregated[yyyyMm].sales += (o.totalAmount || 0);
            aggregated[yyyyMm].profit += (o.profit || 0);
          }
        }
      });
    }

    const salesTrend = periodsList.map(p => aggregated[p.key]);

    // ─── Chart Data: Orders by Platform ───
    const platformCounts = {};
    orders.forEach((o) => {
      const p = o.platform || 'Other';
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });
    const ordersByPlatform = {
      labels: Object.keys(platformCounts),
      data: Object.values(platformCounts),
    };

    // ─── Chart Data: Top Selling Brands ───
    const brandCounts = {};
    orders.forEach((o) => {
      const b = o.sareeBrand || 'Unknown';
      brandCounts[b] = (brandCounts[b] || 0) + (o.quantity || 1);
    });
    const sortedBrands = Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    const topBrands = {
      labels: sortedBrands.map(([label]) => label),
      data: sortedBrands.map(([, count]) => count),
    };

    // ─── Chart Data: Orders by City/State ───
    const cityCounts = {};
    orders.forEach((o) => {
      // Try to extract city from address (last significant segment)
      const addr = o.address || '';
      const parts = addr.split(',').map((s) => s.trim());
      const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const sortedCities = Object.entries(cityCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    const ordersByCity = {
      labels: sortedCities.map(([label]) => label),
      data: sortedCities.map(([, count]) => count),
    };

    // ─── Recent Orders (last 5) ───
    const recentOrders = orders
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        orderId: o.orderId,
        customerName: o.customerName,
        sareeBrand: o.sareeBrand,
        quantity: o.quantity,
        totalAmount: o.totalAmount,
        itemStatus: o.itemStatus,
      }));

    // ─── Inventory Low Stock KPI ───
    const invSnapshot = await db.collection('inventory').get();
    let lowStockItems = 0;
    invSnapshot.forEach((doc) => {
      const item = doc.data();
      const remaining = (item.quantityReceived || 0) - (item.quantitySold || 0);
      if (remaining <= 5) lowStockItems++;
    });

    return res.json({
      kpis: { totalSales, totalProfit, totalOrders, avgOrderValue, pendingDeliveries, lowStockItems },
      charts: { salesTrend, ordersByPlatform, topBrands, ordersByCity },
      recentOrders,
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
