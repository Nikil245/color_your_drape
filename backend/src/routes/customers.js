const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { normalizeOrderForResponse } = require('../utils/orderItems');

const router = express.Router();

router.use(authMiddleware);

/**
 * Build a canonical customer key from an order.
 * Customers with a valid phone are keyed by phone; otherwise by name (+address if available).
 */
function customerKey(order) {
  const phone = order.phone?.trim();
  const hasValidPhone = phone && phone !== '-' && phone !== 'N/A';

  if (hasValidPhone) return `phone:${phone}`;
  if (order.address?.trim()) return `name:${order.customerName?.trim()}|address:${order.address?.trim()}`;
  return `name:${order.customerName?.trim()}`;
}

/**
 * GET /api/customers
 * Auto-derived from unique customers across orders.
 * Returns each unique customer with Total Orders and Total Spend calculated.
 * Query params: search, month (YYYY-MM or 'all')
 */
router.get('/', async (req, res) => {
  try {
    const { search, month } = req.query;
    const snapshot = await db.collection('orders').get();
    const customerMap = {};
    const monthSet = new Set();

    snapshot.forEach((doc) => {
      const order = normalizeOrderForResponse({ id: doc.id, ...doc.data() });
      const dateStr = order.orderPlacedDate || order.createdAt;
      if (dateStr && typeof dateStr === 'string' && dateStr.length >= 7) {
        const ym = dateStr.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthSet.add(ym);
        }
      }

      // Filter by month BEFORE grouping into customer totals
      if (month && month !== 'all') {
        if (!dateStr || typeof dateStr !== 'string' || !dateStr.startsWith(month)) {
          return;
        }
      }

      const key = customerKey(order);

      if (!customerMap[key]) {
        customerMap[key] = {
          name: order.customerName,
          phone: order.phone,
          address: order.address,
          platform: order.platform,
          customerStatus: order.customerStatus || 'New',
          totalOrders: 0,
          totalSpend: 0,
          lastOrderDate: order.orderPlacedDate || order.createdAt,
        };
      }

      customerMap[key].totalOrders += 1;
      customerMap[key].totalSpend += order.totalAmount || 0;

      // Update customer status based on order count
      if (customerMap[key].totalOrders >= 10) {
        customerMap[key].customerStatus = 'VIP';
      } else if (customerMap[key].totalOrders >= 3) {
        customerMap[key].customerStatus = 'Repeat';
      }

      // Track latest order date
      const orderDate = order.orderPlacedDate || order.createdAt;
      if (orderDate > customerMap[key].lastOrderDate) {
        customerMap[key].lastOrderDate = orderDate;
        // Use the latest address and platform
        customerMap[key].address = order.address;
        customerMap[key].platform = order.platform;
      }
    });

    let customers = Object.entries(customerMap).map(([key, c]) => ({ ...c, _key: key }));

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.address?.toLowerCase().includes(q)
      );
    }

    // Sort by total spend descending (VIP / top customers first)
    customers.sort((a, b) => b.totalSpend - a.totalSpend);

    const availableMonths = Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => {
        const [yyyy, mm] = ym.split('-');
        const date = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { value: ym, label };
      });

    return res.json({ customers, total: customers.length, availableMonths });
  } catch (err) {
    console.error('Customers error:', err);
    return res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

/**
 * GET /api/customers/:key
 * Fetch a single customer's full profile and complete order history.
 * :key is a URI-encoded customer key (e.g. "phone:9876543210" or "name:Manasa|address:Udupi").
 */
router.get('/:key', async (req, res) => {
  try {
    const requestedKey = decodeURIComponent(req.params.key);
    const snapshot = await db.collection('orders').get();
    const orders = [];
    let customer = null;

    snapshot.forEach((doc) => {
      const order = normalizeOrderForResponse({ id: doc.id, ...doc.data() });
      const key = customerKey(order);

      if (key === requestedKey) {
        orders.push(order);
        if (!customer) {
          customer = {
            name: order.customerName,
            phone: order.phone,
            address: order.address,
            platform: order.platform,
            customerStatus: order.customerStatus || 'New',
          };
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Sort orders by date descending
    orders.sort((a, b) => (b.orderPlacedDate || b.createdAt || '').localeCompare(a.orderPlacedDate || a.createdAt || ''));

    const totalOrders = orders.length;
    const totalSpend = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 0;

    // Update status based on total orders
    if (totalOrders >= 10) customer.customerStatus = 'VIP';
    else if (totalOrders >= 3) customer.customerStatus = 'Repeat';

    // Payment status breakdown
    const paymentBreakdown = { Paid: 0, Pending: 0, Partial: 0 };
    orders.forEach((o) => {
      const ps = o.paymentStatus || 'Pending';
      paymentBreakdown[ps] = (paymentBreakdown[ps] || 0) + 1;
    });

    return res.json({
      customer: {
        ...customer,
        totalOrders,
        totalSpend,
        avgOrderValue,
        paymentBreakdown,
      },
      orders,
    });
  } catch (err) {
    console.error('Customer detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch customer details.' });
  }
});

module.exports = router;
