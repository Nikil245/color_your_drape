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
 * Deduct or restore stock on a specific variant inside an inventory item.
 */
function updateVariantStock(invData, targetColor, targetMaterial, qtyDelta, action = 'deduct') {
  let variants = invData.variants;
  if (!Array.isArray(variants) || variants.length === 0) {
    const totalQ = Number(invData.totalQuantity ?? invData.quantityReceived ?? 0);
    const totalS = Number(invData.quantitySold || 0);
    variants = [
      {
        color: invData.sareeColor || 'Default',
        material: invData.materialType || 'Default',
        quantity: totalQ,
        quantitySold: totalS,
        quantityRemaining: totalQ - totalS,
      },
    ];
  } else {
    variants = variants.map((v) => ({
      color: v.color || '',
      material: v.material || '',
      quantity: Number(v.quantity || 0),
      quantitySold: Number(v.quantitySold || 0),
      quantityRemaining: Number(v.quantity || 0) - Number(v.quantitySold || 0),
    }));
  }

  const normColor = (targetColor || '').trim().toLowerCase();
  const normMat = (targetMaterial || '').trim().toLowerCase();

  // Find variant by color & material match
  let variantIndex = variants.findIndex(
    (v) =>
      v.color.trim().toLowerCase() === normColor &&
      (normMat === '' || v.material.trim().toLowerCase() === normMat)
  );

  // Fallback match by color only
  if (variantIndex === -1 && normColor) {
    variantIndex = variants.findIndex((v) => v.color.trim().toLowerCase() === normColor);
  }

  // Fallback to first variant if none matched
  if (variantIndex === -1) {
    variantIndex = 0;
  }

  const targetV = variants[variantIndex];
  const vQty = Number(targetV.quantity || 0);
  const currentVSold = Number(targetV.quantitySold || 0);
  const vRemaining = vQty - currentVSold;

  let newVSold;
  if (action === 'deduct') {
    if (qtyDelta > vRemaining) {
      const desc = targetV.color ? `${targetV.material || ''} - ${targetV.color}`.trim() : 'this variant';
      throw new Error(
        `Only ${vRemaining} units of ${invData.brandName || 'this item'} (${desc}) remaining in stock`
      );
    }
    newVSold = currentVSold + qtyDelta;
  } else {
    newVSold = Math.max(0, currentVSold - qtyDelta);
  }

  targetV.quantitySold = newVSold;
  targetV.quantityRemaining = vQty - newVSold;

  const docTotalQuantity = variants.reduce((sum, v) => sum + Number(v.quantity), 0);
  const docTotalSold = variants.reduce((sum, v) => sum + Number(v.quantitySold), 0);
  const docTotalRemaining = docTotalQuantity - docTotalSold;

  return {
    updatedVariants: variants,
    totalQuantity: docTotalQuantity,
    quantitySold: docTotalSold,
    quantityRemaining: docTotalRemaining,
    status: deriveStatus(docTotalRemaining),
  };
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

    const counterRef = db.collection('settings').doc('counters');

    // If no inventoryItemId is provided, create order without inventory link
    if (!inventoryItemId) {
      let nextId = 1001;
      const counterDoc = await counterRef.get();
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
      const { updatedVariants, totalQuantity, quantitySold, quantityRemaining, status } =
        updateVariantStock(inv, sareeColor, materialType, qty, 'deduct');

      // Get and increment counter inside transaction
      const counterDoc = await t.get(counterRef);
      let nextId = 1001;
      if (counterDoc.exists) nextId = counterDoc.data().lastId + 1;
      t.set(counterRef, { lastId: nextId });

      // Update inventory
      t.update(invRef, {
        variants: updatedVariants,
        totalQuantity,
        quantitySold,
        quantityRemaining,
        status,
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
      orders.push({ id: doc.id, ...data });

      const dateStr = data.orderPlacedDate || data.createdAt;
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
        const d = o.orderPlacedDate || o.createdAt || '';
        return typeof d === 'string' && d.startsWith(month);
      });
    }

    // Apply existing filters
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
    const oldColor = oldOrder.sareeColor || '';
    const oldMat = oldOrder.materialType || '';
    const newColor = sareeColor || '';
    const newMat = materialType || '';

    const inventoryChanged =
      oldInvId !== newInvId ||
      oldQty !== newQty ||
      oldColor.trim().toLowerCase() !== newColor.trim().toLowerCase() ||
      oldMat.trim().toLowerCase() !== newMat.trim().toLowerCase();

    // If inventory linkage or quantity changed, use a transaction
    if (inventoryChanged && (oldInvId || newInvId)) {
      await db.runTransaction(async (t) => {
        // ─── 1. ALL READS FIRST ───
        let oldInvDoc = null;
        let newInvDoc = null;

        if (oldInvId) {
          const oldInvRef = db.collection('inventory').doc(oldInvId);
          oldInvDoc = await t.get(oldInvRef);
        }

        if (newInvId) {
          if (newInvId === oldInvId) {
            newInvDoc = oldInvDoc;
          } else {
            const newInvRef = db.collection('inventory').doc(newInvId);
            newInvDoc = await t.get(newInvRef);
          }
        }

        // ─── 2. CALCULATIONS & WRITES (NO READS PAST THIS POINT) ───

        // Case A: Same inventory item, quantity changed
        if (oldInvId && oldInvId === newInvId) {
          if (!newInvDoc || !newInvDoc.exists) {
            throw new Error('Linked inventory item not found.');
          }

          const inv = newInvDoc.data();
          const restoreRes = updateVariantStock(inv, oldColor, oldMat, oldQty, 'restore');
          const restoredInvState = { ...inv, variants: restoreRes.updatedVariants };
          const deductRes = updateVariantStock(restoredInvState, newColor, newMat, newQty, 'deduct');

          const invRef = db.collection('inventory').doc(newInvId);
          t.update(invRef, {
            variants: deductRes.updatedVariants,
            totalQuantity: deductRes.totalQuantity,
            quantitySold: deductRes.quantitySold,
            quantityRemaining: deductRes.quantityRemaining,
            status: deductRes.status,
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Case B: Different inventory items (or linking/unlinking item)

          // Step B1: Restore old inventory item stock
          if (oldInvId && oldInvDoc && oldInvDoc.exists) {
            const oldInv = oldInvDoc.data();
            const restoreRes = updateVariantStock(oldInv, oldColor, oldMat, oldQty, 'restore');

            const oldInvRef = db.collection('inventory').doc(oldInvId);
            t.update(oldInvRef, {
              variants: restoreRes.updatedVariants,
              totalQuantity: restoreRes.totalQuantity,
              quantitySold: restoreRes.quantitySold,
              quantityRemaining: restoreRes.quantityRemaining,
              status: restoreRes.status,
              updatedAt: new Date().toISOString(),
            });
          }

          // Step B2: Deduct from new inventory item stock
          if (newInvId) {
            if (!newInvDoc || !newInvDoc.exists) {
              throw new Error('Linked inventory item not found.');
            }

            const newInv = newInvDoc.data();
            const deductRes = updateVariantStock(newInv, newColor, newMat, newQty, 'deduct');

            const newInvRef = db.collection('inventory').doc(newInvId);
            t.update(newInvRef, {
              variants: deductRes.updatedVariants,
              totalQuantity: deductRes.totalQuantity,
              quantitySold: deductRes.quantitySold,
              quantityRemaining: deductRes.quantityRemaining,
              status: deductRes.status,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Update the order document
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
          const restoreRes = updateVariantStock(inv, order.sareeColor, order.materialType, qty, 'restore');

          t.update(invRef, {
            variants: restoreRes.updatedVariants,
            totalQuantity: restoreRes.totalQuantity,
            quantitySold: restoreRes.quantitySold,
            quantityRemaining: restoreRes.quantityRemaining,
            status: restoreRes.status,
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
module.exports.updateVariantStock = updateVariantStock;
