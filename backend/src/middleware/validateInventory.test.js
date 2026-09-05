const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateInventory } = require('./validate');

async function validate(payload) {
  const app = express();
  app.use(express.json());
  app.post('/', validateInventory, (_req, res) => res.status(204).end());

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });

  try {
    return await fetch(`http://127.0.0.1:${server.address().port}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

const validInventory = {
  brandName: 'Jamuna',
  variants: [{
    color: 'Maroon',
    material: 'Semi-Crape',
    quantity: 2,
    purchasePrice: 695,
    sellingPrice: 1099,
  }, {
    color: 'Blue',
    material: 'Cotton',
    quantity: 3,
    purchasePrice: 450,
    sellingPrice: 850,
  }],
  supplierName: 'Supplier',
};

test('accepts prices on every inventory variant', async () => {
  const response = await validate(validInventory);
  assert.equal(response.status, 204);
});

test('requires per-variant prices even when legacy document prices are submitted', async () => {
  const response = await validate({
    ...validInventory,
    variants: [{ color: 'Maroon', material: 'Semi-Crape', quantity: 2 }],
    purchasePrice: 695,
    sellingPrice: 1099,
  });
  const result = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(
    result.errors.map((error) => error.path).sort(),
    ['variants[0].purchasePrice', 'variants[0].sellingPrice']
  );
});

test('accepts zero as a valid variant price', async () => {
  const response = await validate({
    ...validInventory,
    variants: [{ ...validInventory.variants[0], purchasePrice: 0, sellingPrice: 0 }],
  });
  assert.equal(response.status, 204);
});
