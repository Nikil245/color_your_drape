const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/customers
 * Auto-derived from unique customers across orders.
 * Returns each unique customer with Total Orders and Total Spend calculated.
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const snapshot = await db.collection('orders').get();
    const customerMap = {};

    snapshot.forEach((doc) => {
      const order = doc.data();
      const key = order.phone || order.customerName;

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

    let customers = Object.values(customerMap);

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

    return res.json({ customers, total: customers.length });
  } catch (err) {
    console.error('Customers error:', err);
    return res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

module.exports = router;
