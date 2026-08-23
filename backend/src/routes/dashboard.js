const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * Helper to determine date bounds and time series granularity for a given period.
 */
function getPeriodDateRange(periodStr) {
  const period = periodStr || 'this_month';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  let startDate = null; // YYYY-MM-DD
  let endDate = null;   // YYYY-MM-DD
  let isDaily = true;

  if (period === 'this_month') {
    const daysInM = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    isDaily = true;
  } else if (period === 'last_month') {
    const d = new Date(currentYear, currentMonth - 1, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInM = new Date(y, m + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    isDaily = true;
  } else if (period === 'last_3_months') {
    const d = new Date(currentYear, currentMonth - 2, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInCurrent = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrent).padStart(2, '0')}`;
    isDaily = false;
  } else if (period === 'last_6_months') {
    const d = new Date(currentYear, currentMonth - 5, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInCurrent = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrent).padStart(2, '0')}`;
    isDaily = false;
  } else if (period === 'this_year') {
    startDate = `${currentYear}-01-01`;
    endDate = `${currentYear}-12-31`;
    isDaily = false;
  } else if (period === 'all_time') {
    startDate = null;
    endDate = null;
    isDaily = false;
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    const [yStr, mStr] = period.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const daysInM = new Date(y, m + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    isDaily = true;
  } else {
    // Default fallback to this_month
    const daysInM = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
    isDaily = true;
  }

  return { period, startDate, endDate, isDaily };
}

/**
 * GET /api/dashboard/summary
 * Returns calculated KPIs and chart data from real Firestore orders data.
 * Accepts ?period=this_month | last_month | last_3_months | last_6_months | this_year | all_time | YYYY-MM
 */
router.get('/summary', async (req, res) => {
  try {
    const periodParam = req.query.period || 'this_month';
    const { period, startDate, endDate, isDaily } = getPeriodDateRange(periodParam);

    const snapshot = await db.collection('orders').get();
    const allOrders = [];
    snapshot.forEach((doc) => allOrders.push({ id: doc.id, ...doc.data() }));

    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // ─── Available Months (for specific month dropdown options) ───
    const availableMonthsSet = new Set();
    allOrders.forEach((o) => {
      const dStr = o.orderPlacedDate || (o.createdAt ? o.createdAt.split('T')[0] : '');
      if (dStr && /^\d{4}-\d{2}/.test(dStr)) {
        availableMonthsSet.add(dStr.substring(0, 7));
      }
    });
    const now = new Date();
    const currentYyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    availableMonthsSet.add(currentYyyyMm);

    const availableMonths = Array.from(availableMonthsSet)
      .sort()
      .reverse()
      .map((yyyyMm) => {
        const [y, m] = yyyyMm.split('-');
        const monthName = monthNamesShort[parseInt(m, 10) - 1];
        return {
          value: yyyyMm,
          label: `${monthName} ${y}`,
        };
      });

    // ─── Filter Orders by Period ───
    const filteredOrders = allOrders.filter((o) => {
      if (!startDate || !endDate) return true; // all_time
      const dStr = o.orderPlacedDate || (o.createdAt ? o.createdAt.split('T')[0] : '');
      if (!dStr) return false;
      return dStr >= startDate && dStr <= endDate;
    });

    // ─── KPIs ───
    // Filter paid orders specifically for Sales and Profit calculations
    const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'Paid');

    const totalSales = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalProfit = paidOrders.reduce((sum, o) => sum + (o.profit || 0), 0);

    // KPIs reflecting ALL orders regardless of payment status
    const totalOrders = filteredOrders.length;
    const totalGrossValue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalGrossValue / totalOrders) : 0;

    // Real-time Current State KPIs (NOT filtered by period)
    const pendingDeliveries = allOrders.filter(
      (o) => o.itemStatus && !['Delivered', 'Returned'].includes(o.itemStatus)
    ).length;

    const invSnapshot = await db.collection('inventory').get();
    let lowStockItems = 0;
    invSnapshot.forEach((doc) => {
      const item = doc.data();
      const received = item.totalQuantity ?? item.quantityReceived ?? 0;
      const remaining = received - (item.quantitySold || 0);
      if (remaining <= 5) lowStockItems++;
    });

    // ─── Chart Data: Sales & Profit Trend (Scoped Time Series, Paid Orders Only) ───
    const periodsList = [];
    const aggregated = {};

    if (isDaily) {
      // Daily points between startDate and endDate
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [, , eD] = endDate.split('-').map(Number);

      for (let d = sD; d <= eD; d++) {
        const dateStr = `${sY}-${String(sM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const label = `${monthNamesShort[sM - 1]} ${d}`;
        periodsList.push({ key: dateStr, label });
        aggregated[dateStr] = { period: label, sales: 0, profit: 0 };
      }

      filteredOrders.forEach((o) => {
        if (o.paymentStatus === 'Paid') {
          const dateStr = o.orderPlacedDate || (o.createdAt ? o.createdAt.split('T')[0] : '');
          if (dateStr && aggregated[dateStr]) {
            aggregated[dateStr].sales += (o.totalAmount || 0);
            aggregated[dateStr].profit += (o.profit || 0);
          }
        }
      });
    } else {
      // Monthly points
      let startMonthDate, endMonthDate;

      if (period === 'all_time') {
        let oldestDate = null;
        let newestDate = null;
        allOrders.forEach((o) => {
          const dStr = o.orderPlacedDate || (o.createdAt ? o.createdAt.split('T')[0] : '');
          if (dStr) {
            const d = new Date(dStr);
            if (!isNaN(d.getTime())) {
              if (!oldestDate || d < oldestDate) oldestDate = d;
              if (!newestDate || d > newestDate) newestDate = d;
            }
          }
        });

        if (!oldestDate) oldestDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        if (!newestDate || newestDate < now) newestDate = now;

        startMonthDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1);
        endMonthDate = new Date(newestDate.getFullYear(), newestDate.getMonth(), 1);
      } else {
        const [sY, sM] = startDate.split('-').map(Number);
        const [eY, eM] = endDate.split('-').map(Number);
        startMonthDate = new Date(sY, sM - 1, 1);
        endMonthDate = new Date(eY, eM - 1, 1);
      }

      let cur = new Date(startMonthDate);
      while (cur <= endMonthDate) {
        const y = cur.getFullYear();
        const m = cur.getMonth();
        const yyyyMm = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${monthNamesShort[m]} ${y}`;
        periodsList.push({ key: yyyyMm, label });
        aggregated[yyyyMm] = { period: label, sales: 0, profit: 0 };
        cur.setMonth(cur.getMonth() + 1);
      }

      filteredOrders.forEach((o) => {
        if (o.paymentStatus === 'Paid') {
          const dateStr = o.orderPlacedDate || (o.createdAt ? o.createdAt.split('T')[0] : '');
          if (dateStr) {
            const yyyyMm = dateStr.substring(0, 7);
            if (aggregated[yyyyMm]) {
              aggregated[yyyyMm].sales += (o.totalAmount || 0);
              aggregated[yyyyMm].profit += (o.profit || 0);
            }
          }
        }
      });
    }

    const salesTrend = periodsList.map((p) => aggregated[p.key]);

    // ─── Chart Data: Orders by Platform (Period filtered) ───
    const platformCounts = {};
    filteredOrders.forEach((o) => {
      const p = o.platform || 'Other';
      platformCounts[p] = (platformCounts[p] || 0) + 1;
    });
    const ordersByPlatform = {
      labels: Object.keys(platformCounts),
      data: Object.values(platformCounts),
    };

    // ─── Chart Data: Top Selling Brands (Period filtered) ───
    const brandCounts = {};
    filteredOrders.forEach((o) => {
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

    // ─── Chart Data: Orders by City/State (Period filtered) ───
    const cityCounts = {};
    filteredOrders.forEach((o) => {
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

    // ─── Recent Orders (last 5 overall) ───
    const recentOrders = allOrders
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

    return res.json({
      selectedPeriod: periodParam,
      availableMonths,
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
