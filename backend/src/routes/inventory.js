const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { validateInventory } = require('../middleware/validate');

const router = express.Router();

// All inventory routes require authentication
router.use(authMiddleware);

/**
 * Fetch the low-stock threshold from settings. Falls back to 5.
 */
async function getLowStockThreshold() {
  try {
    const doc = await db.collection('settings').doc('business').get();
    if (doc.exists && typeof doc.data().lowStockThreshold === 'number') {
      return doc.data().lowStockThreshold;
    }
  } catch (_) { /* ignore, use default */ }
  return 5;
}

/**
 * Derive status from quantityRemaining and the configured threshold.
 */
function deriveStatus(remaining, threshold) {
  if (remaining <= 0) return 'Out of Stock';
  if (remaining <= threshold) return 'Low Stock';
  return 'In Stock';
}

/**
 * POST /api/inventory — Create a new stock entry
 */
router.post('/', validateInventory, async (req, res) => {
  try {
    const {
      stockReceivedDate, brandName, variants, purchasePrice, sellingPrice,
      supplierName, supplierPhone, supplierAddress, remarks,
    } = req.body;

    const totalQuantity = variants.reduce((sum, v) => sum + Number(v.quantity), 0);
    const qtySold = 0;
    const qtyRemaining = totalQuantity - qtySold;
    const threshold = await getLowStockThreshold();

    const inventoryData = {
      stockReceivedDate: stockReceivedDate || new Date().toISOString().split('T')[0],
      brandName,
      variants,
      totalQuantity,
      quantitySold: qtySold,
      quantityRemaining: qtyRemaining,
      status: deriveStatus(qtyRemaining, threshold),
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      supplierName,
      supplierPhone: supplierPhone || '',
      supplierAddress: supplierAddress || '',
      remarks: remarks || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await db.collection('inventory').add(inventoryData);

    return res.status(201).json({
      message: 'Inventory item created successfully.',
      item: { id: docRef.id, ...inventoryData },
    });
  } catch (err) {
    console.error('Create inventory error:', err);
    return res.status(500).json({ error: 'Failed to create inventory item.' });
  }
});

/**
 * GET /api/inventory — List all inventory items with optional filters
 * Query params: status, brand, search
 */
router.get('/', async (req, res) => {
  try {
    const { status, brand, search } = req.query;

    const snapshot = await db.collection('inventory').orderBy('createdAt', 'desc').get();
    let items = [];

    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });

    // Apply filters
    if (status) {
      items = items.filter((i) => i.status === status);
    }
    if (brand) {
      items = items.filter((i) => i.brandName === brand);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.brandName?.toLowerCase().includes(q) ||
          i.supplierName?.toLowerCase().includes(q) ||
          (i.sareeColor && i.sareeColor.toLowerCase().includes(q)) ||
          (i.materialType && i.materialType.toLowerCase().includes(q)) ||
          (i.variants && i.variants.some((v) => v.color?.toLowerCase().includes(q) || v.material?.toLowerCase().includes(q)))
      );
    }

    return res.json({ items, total: items.length });
  } catch (err) {
    console.error('List inventory error:', err);
    return res.status(500).json({ error: 'Failed to fetch inventory.' });
  }
});

/**
 * GET /api/inventory/brands — Get unique brand names for dropdowns
 */
router.get('/brands', async (req, res) => {
  try {
    const snapshot = await db.collection('inventory').get();
    const brands = new Set();
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.brandName) brands.add(data.brandName);
    });
    return res.json({ brands: [...brands].sort() });
  } catch (err) {
    console.error('Inventory brands error:', err);
    return res.status(500).json({ error: 'Failed to fetch brands.' });
  }
});

/**
 * PUT /api/inventory/:id — Edit a stock entry
 */
router.put('/:id', validateInventory, async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('inventory').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const {
      stockReceivedDate, brandName, variants,
      quantitySold, purchasePrice,
      sellingPrice, supplierName, supplierPhone, supplierAddress, remarks,
    } = req.body;

    const totalQuantity = variants.reduce((sum, v) => sum + Number(v.quantity), 0);
    const qtySold = Number(quantitySold || 0);
    const qtyRemaining = totalQuantity - qtySold;
    const threshold = await getLowStockThreshold();

    const updateData = {
      stockReceivedDate: stockReceivedDate || '',
      brandName,
      variants,
      totalQuantity,
      quantitySold: qtySold,
      quantityRemaining: qtyRemaining,
      status: deriveStatus(qtyRemaining, threshold),
      purchasePrice: Number(purchasePrice),
      sellingPrice: Number(sellingPrice),
      supplierName,
      supplierPhone: supplierPhone || '',
      supplierAddress: supplierAddress || '',
      remarks: remarks || '',
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updateData);

    return res.json({
      message: 'Inventory item updated successfully.',
      item: { id, ...doc.data(), ...updateData },
    });
  } catch (err) {
    console.error('Update inventory error:', err);
    return res.status(500).json({ error: 'Failed to update inventory item.' });
  }
});

/**
 * DELETE /api/inventory/:id — Remove a stock entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('inventory').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    await docRef.delete();
    return res.json({ message: 'Inventory item deleted successfully.' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    return res.status(500).json({ error: 'Failed to delete inventory item.' });
  }
});

module.exports = router;
