const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { validateOrder } = require('../middleware/validate');

const router = express.Router();

// All order routes require authentication
router.use(authMiddleware);

/**
 * Derive inventory status from quantityRemaining.
 * Uses the same thresholds as the Inventory module.
 */
function deriveStatus(remaining) {
  if (remaining <= 0) return 'Out of Stock';
  if (remaining <= 5) return 'Low Stock';
  return 'In Stock';
}

/**
 * POST /api/orders — Create a new order
 *
 * Uses a Firestore transaction to atomically:
 *   1. Validate available stock
 *   2. Generate the next order ID
 *   3. Create the order document
 *   4. Deduct quantity from the linked inventory item
 */
router.post('/', validateOrder, async (req, res) => {
  try {
    const {
      customerName, phone, address, platform, customerStatus,
      sareeBrand, materialType, sareeColor, inventoryItemId,
      orderPlacedDate, quantity, itemPrice, costPrice, discount,
      paymentStatus, paymentMode, itemStatus, inventoryStatus,
      expectedDeliveryDate, orderDeliveredDate, notes,
    } = req.body;

    const qty = Number(quantity);
    const price = Number(itemPrice);
    const cost = Number(costPrice);
    const disc = Number(discount || 0);

    // Auto-calculated fields
    const totalAmount = price * qty - disc;
    const profit = totalAmount - cost * qty;

    const counterRef = db.collection('counters').doc('orders');

    // If no inventoryItemId is provided, create order without inventory link
    if (!inventoryItemId) {
      const counterDoc = await counterRef.get();
      let nextId = 1001;
      if (counterDoc.exists) nextId = counterDoc.data().lastId + 1;
      await counterRef.set({ lastId: nextId });

      const orderData = {
        orderId: `ORD-${nextId}`,
        customerName, phone, address, platform,
        customerStatus: customerStatus || 'New',
        sareeBrand, materialType: materialType || '',
        sareeColor: sareeColor || '',
        inventoryItemId: '',
        orderPlacedDate: orderPlacedDate || new Date().toISOString().split('T')[0],
        quantity: qty, itemPrice: price, costPrice: cost,
        discount: disc, totalAmount, profit,
        paymentStatus, paymentMode,
        itemStatus, inventoryStatus: inventoryStatus || 'Reserved',
        expectedDeliveryDate: expectedDeliveryDate || '',
        orderDeliveredDate: orderDeliveredDate || '',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await db.collection('orders').add(orderData);
      return res.status(201).json({
        message: 'Order created successfully.',
        order: { id: docRef.id, ...orderData },
      });
    }

    // ─── Transactional order creation with inventory deduction ───
    const invRef = db.collection('inventory').doc(inventoryItemId);
    const orderDocRef = db.collection('orders').doc(); // pre-generate doc ref

    const result = await db.runTransaction(async (t) => {
      const invDoc = await t.get(invRef);
      if (!invDoc.exists) {
        throw new Error('Linked inventory item not found.');
      }

      const inv = invDoc.data();
      const currentRemaining = (inv.quantityReceived || 0) - (inv.quantitySold || 0);

      if (qty > currentRemaining) {
        throw new Error(
          `Only ${currentRemaining} units of ${inv.brandName} - ${inv.materialType || ''} - ${inv.sareeColor} remaining in stock`
        );
      }

      // Get and increment counter inside transaction
      const counterDoc = await t.get(counterRef);
      let nextId = 1001;
      if (counterDoc.exists) nextId = counterDoc.data().lastId + 1;
      t.set(counterRef, { lastId: nextId });

      // Update inventory: increase sold, recalculate remaining & status
      const newSold = (inv.quantitySold || 0) + qty;
      const newRemaining = (inv.quantityReceived || 0) - newSold;
      t.update(invRef, {
        quantitySold: newSold,
        quantityRemaining: newRemaining,
        status: deriveStatus(newRemaining),
        updatedAt: new Date().toISOString(),
      });

      // Create the order
      const orderData = {
        orderId: `ORD-${nextId}`,
        customerName, phone, address, platform,
        customerStatus: customerStatus || 'New',
        sareeBrand, materialType: materialType || '',
        sareeColor: sareeColor || '',
        inventoryItemId,
        orderPlacedDate: orderPlacedDate || new Date().toISOString().split('T')[0],
        quantity: qty, itemPrice: price, costPrice: cost,
        discount: disc, totalAmount, profit,
        paymentStatus, paymentMode,
        itemStatus, inventoryStatus: inventoryStatus || 'Reserved',
        expectedDeliveryDate: expectedDeliveryDate || '',
        orderDeliveredDate: orderDeliveredDate || '',
        notes: notes || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      t.set(orderDocRef, orderData);
      return { id: orderDocRef.id, ...orderData };
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
 * Query params: status, payment, platform, startDate, endDate, search
 */
router.get('/', async (req, res) => {
  try {
    const { status, payment, platform, startDate, endDate, search } = req.query;

    let query = db.collection('orders').orderBy('createdAt', 'desc');

    // We'll fetch all and filter in memory for compound queries
    // (Firestore compound queries need composite indexes)
    const snapshot = await query.get();
    let orders = [];

    snapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    // Apply filters
    if (status) {
      orders = orders.filter((o) => o.itemStatus === status);
    }
    if (payment) {
      orders = orders.filter((o) => o.paymentStatus === payment);
    }
    if (platform) {
      orders = orders.filter((o) => o.platform === platform);
    }
    if (startDate) {
      orders = orders.filter((o) => o.orderPlacedDate >= startDate);
    }
    if (endDate) {
      orders = orders.filter((o) => o.orderPlacedDate <= endDate);
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

    return res.json({ orders, total: orders.length });
  } catch (err) {
    console.error('List orders error:', err);
    return res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

/**
 * PUT /api/orders/:id — Edit an existing order
 *
 * When quantity or inventoryItemId changes, uses a transaction to:
 *   1. Add back the old quantity to the old inventory item
 *   2. Deduct the new quantity from the new inventory item
 *   3. Validate that the new item has enough stock
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
    const {
      customerName, phone, address, platform, customerStatus,
      sareeBrand, materialType, sareeColor, inventoryItemId,
      orderPlacedDate, quantity, itemPrice, costPrice, discount,
      paymentStatus, paymentMode, itemStatus, inventoryStatus,
      expectedDeliveryDate, orderDeliveredDate, notes,
    } = req.body;

    const qty = Number(quantity);
    const price = Number(itemPrice);
    const cost = Number(costPrice);
    const disc = Number(discount || 0);

    const totalAmount = price * qty - disc;
    const profit = totalAmount - cost * qty;

    const updateData = {
      customerName, phone, address, platform,
      customerStatus: customerStatus || 'New',
      sareeBrand, materialType: materialType || '',
      sareeColor: sareeColor || '',
      inventoryItemId: inventoryItemId || '',
      orderPlacedDate: orderPlacedDate || '',
      quantity: qty, itemPrice: price, costPrice: cost,
      discount: disc, totalAmount, profit,
      paymentStatus, paymentMode,
      itemStatus, inventoryStatus: inventoryStatus || 'Reserved',
      expectedDeliveryDate: expectedDeliveryDate || '',
      orderDeliveredDate: orderDeliveredDate || '',
      notes: notes || '',
      updatedAt: new Date().toISOString(),
    };

    const oldInvId = oldOrder.inventoryItemId || '';
    const newInvId = inventoryItemId || '';
    const oldQty = Number(oldOrder.quantity) || 0;
    const newQty = qty;
    const inventoryChanged = oldInvId !== newInvId || oldQty !== newQty;

    // If inventory linkage or quantity changed, use a transaction
    if (inventoryChanged && (oldInvId || newInvId)) {
      await db.runTransaction(async (t) => {
        // 1. Add back old quantity to old inventory item
        if (oldInvId) {
          const oldInvRef = db.collection('inventory').doc(oldInvId);
          const oldInvDoc = await t.get(oldInvRef);
          if (oldInvDoc.exists) {
            const oldInv = oldInvDoc.data();
            const restoredSold = Math.max((oldInv.quantitySold || 0) - oldQty, 0);
            const restoredRemaining = (oldInv.quantityReceived || 0) - restoredSold;
            t.update(oldInvRef, {
              quantitySold: restoredSold,
              quantityRemaining: restoredRemaining,
              status: deriveStatus(restoredRemaining),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // 2. Deduct new quantity from new inventory item
        if (newInvId) {
          const newInvRef = db.collection('inventory').doc(newInvId);
          const newInvDoc = await t.get(newInvRef);
          if (!newInvDoc.exists) {
            throw new Error('Linked inventory item not found.');
          }

          const newInv = newInvDoc.data();
          // Calculate available: current remaining + what we just restored (if same item)
          let currentSold = newInv.quantitySold || 0;
          // If old and new inventory items are the same, we already restored above,
          // so we need to account for that
          if (oldInvId === newInvId) {
            currentSold = Math.max(currentSold - oldQty, 0);
          }
          const currentRemaining = (newInv.quantityReceived || 0) - currentSold;

          if (newQty > currentRemaining) {
            throw new Error(
              `Only ${currentRemaining} units of ${newInv.brandName} - ${newInv.materialType || ''} - ${newInv.sareeColor} remaining in stock`
            );
          }

          const updatedSold = currentSold + newQty;
          const updatedRemaining = (newInv.quantityReceived || 0) - updatedSold;
          t.update(newInvRef, {
            quantitySold: updatedSold,
            quantityRemaining: updatedRemaining,
            status: deriveStatus(updatedRemaining),
            updatedAt: new Date().toISOString(),
          });
        }

        // 3. Update the order
        t.update(orderRef, updateData);
      });

      const updatedDoc = await orderRef.get();
      return res.json({
        message: 'Order updated successfully.',
        order: { id, ...updatedDoc.data() },
      });
    }

    // No inventory change — simple update
    await orderRef.update(updateData);
    return res.json({
      message: 'Order updated successfully.',
      order: { id, ...oldOrder, ...updateData },
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
 *
 * If the order is linked to an inventory item, adds the quantity back
 * (reduces quantitySold) via a transaction.
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
    const invId = order.inventoryItemId || '';
    const qty = Number(order.quantity) || 0;

    if (invId && qty > 0) {
      // Restore stock in a transaction
      await db.runTransaction(async (t) => {
        const invRef = db.collection('inventory').doc(invId);
        const invDoc = await t.get(invRef);
        if (invDoc.exists) {
          const inv = invDoc.data();
          const restoredSold = Math.max((inv.quantitySold || 0) - qty, 0);
          const restoredRemaining = (inv.quantityReceived || 0) - restoredSold;
          t.update(invRef, {
            quantitySold: restoredSold,
            quantityRemaining: restoredRemaining,
            status: deriveStatus(restoredRemaining),
            updatedAt: new Date().toISOString(),
          });
        }
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
