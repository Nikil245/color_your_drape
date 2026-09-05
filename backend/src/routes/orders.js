const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { validateOrder } = require('../middleware/validate');
const {
  quantity,
  normalizeOrderItems,
  normalizeOrderForResponse,
  buildSubmittedItems,
  buildOrderData,
  getLinkedInventoryIds,
  matchesOrderPaymentFilter,
} = require('../utils/orderItems');
const { updateVariantStock } = require('../utils/inventoryVariants');

const router = express.Router();

// All order routes require authentication
router.use(authMiddleware);

function applyInventoryMovement(inventoryStates, item, action, options = {}) {
  const invId = item.inventoryItemId || '';
  const qty = quantity(item.quantity);
  if (!invId || qty <= 0) return;

  const current = inventoryStates.get(invId);
  if (!current || !current.exists) {
    if (options.requireExisting) throw new Error('Linked inventory item not found.');
    return;
  }

  const result = updateVariantStock(current.data, item.sareeColor, item.materialType, qty, action);
  inventoryStates.set(invId, {
    ...current,
    changed: true,
    data: {
      ...current.data,
      variants: result.updatedVariants,
      totalQuantity: result.totalQuantity,
      quantitySold: result.quantitySold,
      quantityRemaining: result.quantityRemaining,
      status: result.status,
    },
  });
}

function getOrderDate(order) {
  return order.orderPlacedDate || (order.createdAt ? order.createdAt.split('T')[0] : '');
}

/**
 * POST /api/orders — Create a new order
 *
 * Uses a Firestore transaction to atomically:
 *   1. Validate available stock per-variant
 *   2. Generate the next order ID
 *   3. Create the order document
 *   4. Deduct quantity from the linked inventory variant
 */
router.post('/', validateOrder, async (req, res) => {
  try {
    const items = buildSubmittedItems(req.body);
    const linkedInventoryIds = getLinkedInventoryIds(items);
    const counterRef = db.collection('settings').doc('counters');
    const orderDocRef = db.collection('orders').doc(); // pre-generate doc ref

    const result = await db.runTransaction(async (t) => {
      const inventoryStates = new Map();
      for (const invId of linkedInventoryIds) {
        const invRef = db.collection('inventory').doc(invId);
        const invDoc = await t.get(invRef);
        inventoryStates.set(invId, {
          ref: invRef,
          exists: invDoc.exists,
          data: invDoc.exists ? invDoc.data() : null,
          changed: false,
        });
      }

      // Get and increment counter inside transaction
      const counterDoc = await t.get(counterRef);
      let nextId = 1001;
      if (counterDoc.exists) nextId = counterDoc.data().lastId + 1;
      t.set(counterRef, { lastId: nextId });

      items.forEach((item) => applyInventoryMovement(inventoryStates, item, 'deduct', { requireExisting: true }));

      const updatedAt = new Date().toISOString();
      inventoryStates.forEach((state) => {
        if (!state.changed) return;
        t.update(state.ref, {
          variants: state.data.variants,
          totalQuantity: state.data.totalQuantity,
          quantitySold: state.data.quantitySold,
          quantityRemaining: state.data.quantityRemaining,
          status: state.data.status,
          updatedAt,
        });
      });

      // Create the order
      const orderData = {
        orderId: `ORD-${nextId}`,
        ...buildOrderData(req.body, items, {
          createdAt: updatedAt,
          defaultOrderPlacedDate: new Date().toISOString().split('T')[0],
        }),
      };

      t.set(orderDocRef, orderData);
      return normalizeOrderForResponse({ id: orderDocRef.id, ...orderData });
    });

    return res.status(201).json({
      message: 'Order created successfully.',
      order: result,
    });
  } catch (err) {
    console.error('Create order error:', err);
    // Surface stock-validation errors with 400, others with 500
    if (err.message && (err.message.includes('remaining in stock') || err.message.includes('not found'))) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to create order.' });
  }
});

/**
 * GET /api/orders — List all orders with optional filters
 * Query params: status, payment, platform, startDate, endDate, search, month
 */
router.get('/', async (req, res) => {
  try {
    const { status, payment, platform, startDate, endDate, search, month } = req.query;

    let query = db.collection('orders').orderBy('createdAt', 'desc');

    const snapshot = await query.get();
    let orders = [];
    const monthSet = new Set();

    snapshot.forEach((doc) => {
      const data = doc.data();
      orders.push(normalizeOrderForResponse({ id: doc.id, ...data }));

      const dateStr = getOrderDate(data);
      if (dateStr && typeof dateStr === 'string' && dateStr.length >= 7) {
        const ym = dateStr.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(ym)) {
          monthSet.add(ym);
        }
      }
    });

    const availableMonths = Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => {
        const [yyyy, mm] = ym.split('-');
        const date = new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, 1);
        const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        return { value: ym, label };
      });

    // Apply month filter
    if (month && month !== 'all') {
      orders = orders.filter((o) => {
        const d = getOrderDate(o);
        return typeof d === 'string' && d.startsWith(month);
      });
    }

    // Apply existing filters
    if (status) {
      if (status === 'PendingDelivery') {
        orders = orders.filter((o) => o.itemStatus && !['Delivered', 'Returned'].includes(o.itemStatus));
      } else {
        orders = orders.filter((o) => o.itemStatus === status);
      }
    }
    if (payment) {
      orders = orders.filter((o) => matchesOrderPaymentFilter(o, payment));
    }
    if (platform) {
      orders = orders.filter((o) => o.platform === platform);
    }
    if (startDate) {
      orders = orders.filter((o) => getOrderDate(o) >= startDate);
    }
    if (endDate) {
      orders = orders.filter((o) => getOrderDate(o) <= endDate);
    }
    if (search) {
      const q = search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.orderId?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.phone?.includes(q)
      );
    }

    return res.json({ orders, total: orders.length, availableMonths });
  } catch (err) {
    console.error('List orders error:', err);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

/**
 * PUT /api/orders/:id — Edit an existing order
 */
router.put('/:id', validateOrder, async (req, res) => {
  try {
    const { id } = req.params;
    const orderRef = db.collection('orders').doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const oldOrder = orderDoc.data();
    const oldItems = normalizeOrderItems(oldOrder);
    const newItems = buildSubmittedItems(req.body);
    const updateData = buildOrderData(req.body, newItems);
    const linkedInventoryIds = getLinkedInventoryIds([...oldItems, ...newItems]);

    if (linkedInventoryIds.length > 0) {
      await db.runTransaction(async (t) => {
        const inventoryStates = new Map();
        for (const invId of linkedInventoryIds) {
          const invRef = db.collection('inventory').doc(invId);
          const invDoc = await t.get(invRef);
          inventoryStates.set(invId, {
            ref: invRef,
            exists: invDoc.exists,
            data: invDoc.exists ? invDoc.data() : null,
            changed: false,
          });
        }

        oldItems.forEach((item) => applyInventoryMovement(inventoryStates, item, 'restore'));
        newItems.forEach((item) => applyInventoryMovement(inventoryStates, item, 'deduct', { requireExisting: true }));

        const updatedAt = new Date().toISOString();
        inventoryStates.forEach((state) => {
          if (!state.changed) return;
          t.update(state.ref, {
            variants: state.data.variants,
            totalQuantity: state.data.totalQuantity,
            quantitySold: state.data.quantitySold,
            quantityRemaining: state.data.quantityRemaining,
            status: state.data.status,
            updatedAt,
          });
        });

        // Update the order document
        t.update(orderRef, { ...updateData, updatedAt });
      });

      const updatedDoc = await orderRef.get();
      return res.json({
        message: 'Order updated successfully.',
        order: normalizeOrderForResponse({ id, ...updatedDoc.data() }),
      });
    }

    // No inventory change — simple update
    await orderRef.update(updateData);
    return res.json({
      message: 'Order updated successfully.',
      order: normalizeOrderForResponse({ id, ...oldOrder, ...updateData }),
    });
  } catch (err) {
    console.error('Update order error:', err);
    if (err.message && (err.message.includes('remaining in stock') || err.message.includes('not found'))) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to update order.' });
  }
});

/**
 * DELETE /api/orders/:id — Delete an order
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orderRef = db.collection('orders').doc(id);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderDoc.data();
    const items = normalizeOrderItems(order);
    const linkedInventoryIds = getLinkedInventoryIds(items);

    if (linkedInventoryIds.length > 0) {
      // Restore stock in a transaction
      await db.runTransaction(async (t) => {
        const inventoryStates = new Map();
        for (const invId of linkedInventoryIds) {
          const invRef = db.collection('inventory').doc(invId);
          const invDoc = await t.get(invRef);
          inventoryStates.set(invId, {
            ref: invRef,
            exists: invDoc.exists,
            data: invDoc.exists ? invDoc.data() : null,
            changed: false,
          });
        }

        items.forEach((item) => applyInventoryMovement(inventoryStates, item, 'restore'));

        const updatedAt = new Date().toISOString();
        inventoryStates.forEach((state) => {
          if (!state.changed) return;
          t.update(state.ref, {
            variants: state.data.variants,
            totalQuantity: state.data.totalQuantity,
            quantitySold: state.data.quantitySold,
            quantityRemaining: state.data.quantityRemaining,
            status: state.data.status,
            updatedAt,
          });
        });

        t.delete(orderRef);
      });
    } else {
      await orderRef.delete();
    }

    return res.json({ message: 'Order deleted successfully.' });
  } catch (err) {
    console.error('Delete order error:', err);
    return res.status(500).json({ error: 'Failed to delete order.' });
  }
});

module.exports = router;
module.exports.updateVariantStock = updateVariantStock;
module.exports.normalizeOrderItems = normalizeOrderItems;
module.exports.normalizeOrderForResponse = normalizeOrderForResponse;
