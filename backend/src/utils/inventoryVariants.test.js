const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeInventoryVariants, updateVariantStock } = require('./inventoryVariants');

test('normalizes old variant records with document-level price defaults', () => {
  const variants = normalizeInventoryVariants({
    purchasePrice: 695,
    sellingPrice: 1099,
    variants: [
      { color: 'Maroon', material: 'Semi-Crape', quantity: 5, quantitySold: 2 },
      { color: 'Blue', material: 'Cotton', quantity: 3, quantitySold: 0, purchasePrice: 0, sellingPrice: 850 },
    ],
  });

  assert.deepEqual(
    variants.map(({ purchasePrice, sellingPrice }) => ({ purchasePrice, sellingPrice })),
    [
      { purchasePrice: 695, sellingPrice: 1099 },
      { purchasePrice: 0, sellingPrice: 850 },
    ]
  );
});

test('normalizes legacy single-item inventory into a priced variant', () => {
  const [variant] = normalizeInventoryVariants({
    sareeColor: 'Green',
    materialType: 'Cotton',
    quantityReceived: 4,
    quantitySold: 1,
    purchasePrice: 450,
    sellingPrice: 850,
  });

  assert.deepEqual(variant, {
    color: 'Green',
    material: 'Cotton',
    quantity: 4,
    quantitySold: 1,
    quantityRemaining: 3,
    purchasePrice: 450,
    sellingPrice: 850,
  });
});

test('deduct and restore stock preserve prices and other variant properties', () => {
  const inventory = {
    brandName: 'Jamuna',
    variants: [
      {
        color: 'Maroon',
        material: 'Semi-Crape',
        quantity: 5,
        quantitySold: 1,
        purchasePrice: 695,
        sellingPrice: 1099,
        reference: 'batch-a',
      },
      {
        color: 'Blue',
        material: 'Cotton',
        quantity: 4,
        quantitySold: 0,
        purchasePrice: 450,
        sellingPrice: 850,
        reference: 'batch-b',
      },
    ],
  };

  const deducted = updateVariantStock(inventory, 'Blue', 'Cotton', 2, 'deduct');
  assert.equal(deducted.updatedVariants[1].quantitySold, 2);
  assert.equal(deducted.updatedVariants[1].purchasePrice, 450);
  assert.equal(deducted.updatedVariants[1].sellingPrice, 850);
  assert.equal(deducted.updatedVariants[1].reference, 'batch-b');
  assert.equal(deducted.updatedVariants[0].purchasePrice, 695);
  assert.equal(deducted.updatedVariants[0].sellingPrice, 1099);

  const restored = updateVariantStock(
    { ...inventory, variants: deducted.updatedVariants },
    'Blue',
    'Cotton',
    2,
    'restore'
  );
  assert.equal(restored.updatedVariants[1].quantitySold, 0);
  assert.equal(restored.updatedVariants[1].purchasePrice, 450);
  assert.equal(restored.updatedVariants[1].sellingPrice, 850);
  assert.equal(restored.updatedVariants[1].reference, 'batch-b');
});

test('stock movement lazily applies legacy prices to variants', () => {
  const result = updateVariantStock({
    brandName: 'Legacy',
    purchasePrice: 500,
    sellingPrice: 900,
    variants: [{ color: 'Red', material: 'Silk', quantity: 2, quantitySold: 0 }],
  }, 'Red', 'Silk', 1, 'deduct');

  assert.equal(result.updatedVariants[0].purchasePrice, 500);
  assert.equal(result.updatedVariants[0].sellingPrice, 900);
  assert.equal(result.updatedVariants[0].quantitySold, 1);
});

test('edit-style restore and re-deduct retain prices on both affected variants', () => {
  const inventory = {
    brandName: 'Jamuna',
    variants: [
      {
        color: 'Maroon', material: 'Semi-Crape', quantity: 3, quantitySold: 1,
        purchasePrice: 695, sellingPrice: 1099,
      },
      {
        color: 'Blue', material: 'Cotton', quantity: 3, quantitySold: 0,
        purchasePrice: 450, sellingPrice: 850,
      },
    ],
  };

  const restored = updateVariantStock(inventory, 'Maroon', 'Semi-Crape', 1, 'restore');
  const moved = updateVariantStock(
    { ...inventory, variants: restored.updatedVariants },
    'Blue',
    'Cotton',
    1,
    'deduct'
  );

  assert.deepEqual(
    moved.updatedVariants.map(({ quantitySold, purchasePrice, sellingPrice }) => ({
      quantitySold, purchasePrice, sellingPrice,
    })),
    [
      { quantitySold: 0, purchasePrice: 695, sellingPrice: 1099 },
      { quantitySold: 1, purchasePrice: 450, sellingPrice: 850 },
    ]
  );
});
