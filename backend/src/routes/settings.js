const express = require('express');
const { db } = require('../config/firebase');
const authMiddleware = require('../middleware/auth');
const { validateBusinessSettings } = require('../middleware/validate');

const router = express.Router();

// All settings routes require authentication
router.use(authMiddleware);

const SETTINGS_DOC = db.collection('settings').doc('business');

/**
 * GET /api/settings/business
 * Return the business settings document. Returns defaults if not yet saved.
 */
router.get('/business', async (req, res) => {
  try {
    const doc = await SETTINGS_DOC.get();

    if (!doc.exists) {
      // Return safe defaults so the frontend always gets a consistent shape
      return res.json({
        settings: {
          businessName: 'Colour Your Drape',
          tagline: 'Artisanal Luxury',
          contactPhone: '',
          lowStockThreshold: 5,
        },
      });
    }

    return res.json({ settings: doc.data() });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * PUT /api/settings/business
 * Create or overwrite the business settings document.
 */
router.put('/business', validateBusinessSettings, async (req, res) => {
  try {
    const { businessName, tagline, contactPhone, lowStockThreshold } = req.body;

    const settingsData = {
      businessName,
      tagline: tagline || '',
      contactPhone: contactPhone || '',
      lowStockThreshold: lowStockThreshold !== undefined ? Number(lowStockThreshold) : 5,
      updatedAt: new Date().toISOString(),
    };

    await SETTINGS_DOC.set(settingsData, { merge: true });

    return res.json({
      message: 'Settings saved successfully.',
      settings: settingsData,
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Failed to save settings.' });
  }
});

module.exports = router;
