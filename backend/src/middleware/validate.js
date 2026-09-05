const { body, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return 400 on errors.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const hasItemsArray = (_value, { req }) => Array.isArray(req.body.items);
const hasNoItemsArray = (_value, { req }) => !Array.isArray(req.body.items);

/**
 * Sanitize and validate order creation/update fields.
 */
const validateOrder = [
  body('customerName').trim().notEmpty().withMessage('Customer name is required').escape(),
  body('phone').trim().notEmpty().withMessage('Phone number is required').escape(),
  body('address').trim().notEmpty().withMessage('Address is required').escape(),
  body('platform').trim().isIn(['Instagram', 'WhatsApp']).withMessage('Platform must be Instagram or WhatsApp'),
  body('customerStatus').optional().trim().isIn(['New', 'Repeat', 'VIP']).withMessage('Invalid customer status'),
  body('items').custom((items, { req }) => {
    if (Array.isArray(items) && items.length > 0) return true;
    if (items !== undefined) throw new Error('At least one saree item is required');
    if (req.body.sareeBrand && req.body.materialType && req.body.sareeColor) return true;
    throw new Error('At least one saree item is required');
  }),
  body('items.*.lineItemId').if(hasItemsArray).optional({ checkFalsy: true }).trim().escape(),
  body('items.*.sareeBrand').if(hasItemsArray).trim().notEmpty().withMessage('Saree brand is required').escape(),
  body('items.*.materialType').if(hasItemsArray).trim().notEmpty().withMessage('Material type is required').escape(),
  body('items.*.sareeColor').if(hasItemsArray).trim().notEmpty().withMessage('Saree color is required').escape(),
  body('items.*.inventoryItemId').if(hasItemsArray).optional({ checkFalsy: true }).trim().escape(),
  body('items.*.quantity').if(hasItemsArray).isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.itemPrice').if(hasItemsArray).isFloat({ min: 0 }).withMessage('Item price must be a positive number'),
  body('items.*.costPrice').if(hasItemsArray).isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('items.*.discount').if(hasItemsArray).optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
  body('items.*.paymentStatus').if(hasItemsArray).optional({ checkFalsy: true }).trim().isIn(['Paid', 'Pending', 'Partial']).withMessage('Invalid payment status'),
  body('sareeBrand').if(hasNoItemsArray).trim().notEmpty().withMessage('Saree brand is required').escape(),
  body('materialType').if(hasNoItemsArray).trim().notEmpty().withMessage('Material type is required').escape(),
  body('sareeColor').if(hasNoItemsArray).trim().notEmpty().withMessage('Saree color is required').escape(),
  body('inventoryItemId').if(hasNoItemsArray).optional({ checkFalsy: true }).trim().escape(),
  body('orderPlacedDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid order date'),
  body('quantity').if(hasNoItemsArray).isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('itemPrice').if(hasNoItemsArray).isFloat({ min: 0 }).withMessage('Item price must be a positive number'),
  body('costPrice').if(hasNoItemsArray).isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('discount').if(hasNoItemsArray).optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
  body('paymentStatus').if(hasNoItemsArray).trim().isIn(['Paid', 'Pending', 'Partial']).withMessage('Invalid payment status'),
  body('paymentStatus').if(hasItemsArray).optional({ checkFalsy: true }).trim().isIn(['Paid', 'Pending', 'Partial']).withMessage('Invalid payment status'),
  body('paymentMode').trim().isIn(['UPI', 'Bank Transfer', 'COD']).withMessage('Invalid payment mode'),
  body('itemStatus').trim().isIn(['Confirmed', 'Packed', 'Shipped', 'Delivered', 'Returned']).withMessage('Invalid item status'),
  body('inventoryStatus').optional().trim().isIn(['In Stock', 'Reserved', 'Sold']).withMessage('Invalid inventory status'),
  body('expectedDeliveryDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid expected delivery date'),
  body('orderDeliveredDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid delivered date'),
  body('notes').optional().trim().escape(),
  handleValidationErrors,
];

/**
 * Sanitize and validate login fields.
 */
const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

/**
 * Sanitize and validate register fields.
 */
const validateRegister = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  handleValidationErrors,
];

/**
 * Sanitize and validate inventory creation/update fields.
 */
const validateInventory = [
  body('stockReceivedDate').optional({ checkFalsy: true }).isISO8601().withMessage('Invalid stock received date'),
  body('brandName').trim().notEmpty().withMessage('Brand name is required').escape(),
  body('variants').isArray({ min: 1 }).withMessage('At least one variant is required'),
  body('variants.*.color').trim().notEmpty().withMessage('Variant color is required').escape(),
  body('variants.*.material').trim().notEmpty().withMessage('Variant material is required').escape(),
  body('variants.*.quantity').isInt({ min: 1 }).withMessage('Variant quantity must be a positive integer'),
  body('variants.*.quantitySold').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Variant quantity sold must be a non-negative integer'),
  body('variants.*.purchasePrice').isFloat({ min: 0 }).withMessage('Variant purchase price must be a non-negative number'),
  body('variants.*.sellingPrice').isFloat({ min: 0 }).withMessage('Variant selling price must be a non-negative number'),
  body('quantitySold').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Quantity sold must be a non-negative integer'),
  body('supplierName').trim().notEmpty().withMessage('Supplier name is required').escape(),
  body('supplierPhone').optional({ checkFalsy: true }).trim().matches(/^[+]?[\d\s-]{7,15}$/).withMessage('Invalid supplier phone number').escape(),
  body('supplierAddress').optional({ checkFalsy: true }).trim().escape(),
  body('remarks').optional({ checkFalsy: true }).trim().escape(),
  handleValidationErrors,
];

/**
 * Sanitize and validate profile name update.
 */
const validateUpdateProfile = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  handleValidationErrors,
];

/**
 * Sanitize and validate change-password fields.
 */
const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  handleValidationErrors,
];

/**
 * Sanitize and validate business settings fields.
 */
const validateBusinessSettings = [
  body('businessName').trim().notEmpty().withMessage('Business name is required').escape(),
  body('tagline').optional({ checkFalsy: true }).trim().escape(),
  body('contactPhone').optional({ checkFalsy: true }).trim().escape(),
  body('lowStockThreshold').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Low stock threshold must be a non-negative integer'),
  handleValidationErrors,
];

module.exports = { validateOrder, validateLogin, validateRegister, validateInventory, validateUpdateProfile, validateChangePassword, validateBusinessSettings };
