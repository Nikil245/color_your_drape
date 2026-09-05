function numericValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Return a consistent variant array for both current and legacy inventory records.
 * Legacy document-level prices are exposed as defaults without requiring a backfill.
 */
function normalizeInventoryVariants(inventory = {}) {
  const legacyPurchasePrice = numericValue(inventory.purchasePrice);
  const legacySellingPrice = numericValue(inventory.sellingPrice);

  if (Array.isArray(inventory.variants) && inventory.variants.length > 0) {
    return inventory.variants.map((variant) => {
      const quantity = numericValue(variant.quantity);
      const quantitySold = numericValue(variant.quantitySold);

      return {
        ...variant,
        color: variant.color || '',
        material: variant.material || '',
        quantity,
        quantitySold,
        quantityRemaining: quantity - quantitySold,
        purchasePrice: numericValue(variant.purchasePrice ?? inventory.purchasePrice, legacyPurchasePrice),
        sellingPrice: numericValue(variant.sellingPrice ?? inventory.sellingPrice, legacySellingPrice),
      };
    });
  }

  const quantity = numericValue(inventory.totalQuantity ?? inventory.quantityReceived);
  const quantitySold = numericValue(inventory.quantitySold);

  return [{
    color: inventory.sareeColor || 'Default',
    material: inventory.materialType || 'Default',
    quantity,
    quantitySold,
    quantityRemaining: quantity - quantitySold,
    purchasePrice: legacyPurchasePrice,
    sellingPrice: legacySellingPrice,
  }];
}

function deriveStatus(remaining, threshold = 5) {
  if (remaining <= 0) return 'Out of Stock';
  if (remaining <= threshold) return 'Low Stock';
  return 'In Stock';
}

/**
 * Deduct or restore stock while retaining every field on every variant, including prices.
 */
function updateVariantStock(
  inventory,
  targetColor,
  targetMaterial,
  quantityDelta,
  action = 'deduct',
  threshold = 5
) {
  const variants = normalizeInventoryVariants(inventory);
  const normalizedColor = (targetColor || '').trim().toLowerCase();
  const normalizedMaterial = (targetMaterial || '').trim().toLowerCase();

  let variantIndex = variants.findIndex(
    (variant) =>
      variant.color.trim().toLowerCase() === normalizedColor &&
      (normalizedMaterial === '' || variant.material.trim().toLowerCase() === normalizedMaterial)
  );

  if (variantIndex === -1 && normalizedColor) {
    variantIndex = variants.findIndex(
      (variant) => variant.color.trim().toLowerCase() === normalizedColor
    );
  }

  if (variantIndex === -1) variantIndex = 0;

  const targetVariant = variants[variantIndex];
  const variantQuantity = numericValue(targetVariant.quantity);
  const currentSold = numericValue(targetVariant.quantitySold);
  const remaining = variantQuantity - currentSold;
  const delta = numericValue(quantityDelta);

  if (action === 'deduct') {
    if (delta > remaining) {
      const description = targetVariant.color
        ? `${targetVariant.material || ''} - ${targetVariant.color}`.trim()
        : 'this variant';
      throw new Error(
        `Only ${remaining} units of ${inventory.brandName || 'this item'} (${description}) remaining in stock`
      );
    }
    targetVariant.quantitySold = currentSold + delta;
  } else {
    targetVariant.quantitySold = Math.max(0, currentSold - delta);
  }

  targetVariant.quantityRemaining = variantQuantity - targetVariant.quantitySold;

  const totalQuantity = variants.reduce((sum, variant) => sum + numericValue(variant.quantity), 0);
  const quantitySold = variants.reduce((sum, variant) => sum + numericValue(variant.quantitySold), 0);
  const quantityRemaining = totalQuantity - quantitySold;

  return {
    updatedVariants: variants,
    totalQuantity,
    quantitySold,
    quantityRemaining,
    status: deriveStatus(quantityRemaining, threshold),
  };
}

module.exports = { normalizeInventoryVariants, updateVariantStock };
