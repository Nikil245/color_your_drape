const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getOrderDate(order) {
  return order.orderPlacedDate || (order.createdAt ? order.createdAt.split('T')[0] : '');
}

/**
 * Mirrors Dashboard period bounds without changing the existing Dashboard route.
 * Supports reports-only custom ranges through period=custom&startDate&endDate.
 */
function getPeriodDateRange(periodStr, customStartDate, customEndDate) {
  const period = periodStr || 'this_month';
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let startDate = null;
  let endDate = null;

  if (period === 'custom') {
    if (!isIsoDate(customStartDate) || !isIsoDate(customEndDate)) {
      const err = new Error('Custom reports require valid startDate and endDate values.');
      err.status = 400;
      throw err;
    }
    if (customStartDate > customEndDate) {
      const err = new Error('startDate cannot be after endDate.');
      err.status = 400;
      throw err;
    }
    startDate = customStartDate;
    endDate = customEndDate;
  } else if (period === 'this_month') {
    const daysInM = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
  } else if (period === 'last_month') {
    const d = new Date(currentYear, currentMonth - 1, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInM = new Date(y, m + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
  } else if (period === 'last_3_months') {
    const d = new Date(currentYear, currentMonth - 2, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInCurrent = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrent).padStart(2, '0')}`;
  } else if (period === 'last_6_months') {
    const d = new Date(currentYear, currentMonth - 5, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInCurrent = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrent).padStart(2, '0')}`;
  } else if (period === 'this_year') {
    startDate = `${currentYear}-01-01`;
    endDate = `${currentYear}-12-31`;
  } else if (period === 'all_time') {
    startDate = null;
    endDate = null;
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    const [yStr, mStr] = period.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const daysInM = new Date(y, m + 1, 0).getDate();
    startDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    endDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
  } else {
    const daysInM = new Date(currentYear, currentMonth + 1, 0).getDate();
    startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInM).padStart(2, '0')}`;
  }

  return { period, startDate, endDate };
}

function filterOrdersByDateRange(orders, startDate, endDate) {
  return orders.filter((order) => {
    if (!startDate || !endDate) return true;
    const dateStr = getOrderDate(order);
    if (!dateStr) return false;
    return dateStr >= startDate && dateStr <= endDate;
  });
}

function customerKey(order) {
  const phone = order.phone?.trim();
  const hasValidPhone = phone && phone !== '-' && phone !== 'N/A';

  if (hasValidPhone) return `phone:${phone}`;
  if (order.address?.trim()) return `name:${order.customerName?.trim()}|address:${order.address?.trim()}`;
  return `name:${order.customerName?.trim()}`;
}

function money(value) {
  return Number(value) || 0;
}

/**
 * GET /api/reports/summary
 * Query params:
 *   period=this_month | last_month | last_3_months | this_year | all_time | YYYY-MM | custom
 *   startDate/endDate required when period=custom
 */
router.get('/summary', async (req, res) => {
  try {
    const periodParam = req.query.period || 'this_month';
    const { period, startDate, endDate } = getPeriodDateRange(
      periodParam,
      req.query.startDate,
      req.query.endDate
    );

    const snapshot = await db.collection('orders').get();
    const allOrders = [];
    snapshot.forEach((doc) => allOrders.push({ id: doc.id, ...doc.data() }));

    const filteredOrders = filterOrdersByDateRange(allOrders, startDate, endDate);
    const paidOrders = filteredOrders.filter((order) => order.paymentStatus === 'Paid');

    const totalSales = paidOrders.reduce((sum, order) => sum + money(order.totalAmount), 0);
    const totalProfit = paidOrders.reduce((sum, order) => sum + money(order.profit), 0);
    const totalOrders = filteredOrders.length;
    const totalGrossValue = filteredOrders.reduce((sum, order) => sum + money(order.totalAmount), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalGrossValue / totalOrders) : 0;

    const brandMap = {};
    filteredOrders.forEach((order) => {
      const brandName = order.sareeBrand || 'Unknown';
      if (!brandMap[brandName]) {
        brandMap[brandName] = { brandName, quantitySold: 0, revenue: 0 };
      }
      brandMap[brandName].quantitySold += Number(order.quantity) || 1;
      if (order.paymentStatus === 'Paid') {
        brandMap[brandName].revenue += money(order.totalAmount);
      }
    });
    const topSellingBrands = Object.values(brandMap)
      .sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue)
      .slice(0, 10);

    const customerMap = {};
    filteredOrders.forEach((order) => {
      const key = customerKey(order);
      if (!customerMap[key]) {
        customerMap[key] = {
          name: order.customerName || 'Unknown',
          phone: order.phone || '',
          totalOrders: 0,
          totalSpent: 0,
        };
      }
      customerMap[key].totalOrders += 1;
      customerMap[key].totalSpent += money(order.totalAmount);
    });
    const customerSummary = Object.values(customerMap)
      .sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders);

    const paymentStatuses = ['Paid', 'Pending', 'Partial'];
    const paymentMap = paymentStatuses.reduce((acc, status) => {
      acc[status] = { status, count: 0, amount: 0 };
      return acc;
    }, {});
    filteredOrders.forEach((order) => {
      const status = paymentStatuses.includes(order.paymentStatus) ? order.paymentStatus : 'Pending';
      paymentMap[status].count += 1;
      paymentMap[status].amount += money(order.totalAmount);
    });

    return res.json({
      selectedPeriod: period,
      dateRange: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      summary: { totalSales, totalProfit, totalOrders, avgOrderValue },
      topSellingBrands,
      customerSummary,
      paymentStatusBreakdown: paymentStatuses.map((status) => paymentMap[status]),
    });
  } catch (err) {
    console.error('Reports summary error:', err);
    return res.status(err.status || 500).json({
      error: err.status ? err.message : 'Failed to fetch report data.',
    });
  }
});

module.exports = router;
