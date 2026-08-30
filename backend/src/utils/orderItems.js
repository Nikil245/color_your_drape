function money(value) {
  return Number(value) || 0;
}

function quantity(value) {
  return Number(value) || 0;
}

function normalizePaymentStatus(value, fallback = 'Pending') {
  const status = value || fallback || 'Pending';
  return ['Paid', 'Pending', 'Partial'].includes(status) ? status : 'Pending';
}

function createLineItemId(index) {
  return `item-${index + 1}`;
}

function normalizeLineItem(item, index = 0, fallbackPaymentStatus = 'Pending') {
  const qty = quantity(item.quantity);
  const price = money(item.itemPrice);
  const cost = money(item.costPrice);
  const disc = money(item.discount);
  const totalAmount = price * qty - disc;
  const profit = totalAmount - cost * qty;

  return {
    lineItemId: item.lineItemId || createLineItemId(index),
    sareeBrand: item.sareeBrand || '',
    materialType: item.materialType || '',
    sareeColor: item.sareeColor || '',
    inventoryItemId: item.inventoryItemId || '',
    quantity: qty,
    itemPrice: price,
    costPrice: cost,
    discount: disc,
    totalAmount,
    profit,
    paymentStatus: normalizePaymentStatus(item.paymentStatus, fallbackPaymentStatus),
  };
}

function legacyItemFromOrder(order) {
  return {
    lineItemId: order.lineItemId || createLineItemId(0),
    sareeBrand: order.sareeBrand || '',
    materialType: order.materialType || '',
    sareeColor: order.sareeColor || '',
    inventoryItemId: order.inventoryItemId || '',
    quantity: quantity(order.quantity),
    itemPrice: money(order.itemPrice),
    costPrice: money(order.costPrice),
    discount: money(order.discount),
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
  };
}

function normalizeOrderItems(order) {
  const fallbackPaymentStatus = normalizePaymentStatus(order.paymentStatus);
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((item, index) => normalizeLineItem(item, index, fallbackPaymentStatus));
  }

  return [normalizeLineItem(legacyItemFromOrder(order), 0, fallbackPaymentStatus)];
}

function getOrderTotals(items) {
  return items.reduce(
    (acc, item) => ({
      quantity: acc.quantity + quantity(item.quantity),
      discount: acc.discount + money(item.discount),
      totalAmount: acc.totalAmount + money(item.totalAmount),
      profit: acc.profit + money(item.profit),
    }),
    { quantity: 0, discount: 0, totalAmount: 0, profit: 0 }
  );
}

function buildItemSummary(items) {
  if (items.length === 0) return '';
  if (items.length === 1) {
    const item = items[0];
    const details = [item.sareeBrand, item.materialType, item.sareeColor].filter(Boolean).join(' - ');
    return `${item.quantity}x ${details || 'Saree'}`;
  }

  return `${items.length} sarees (${items.reduce((sum, item) => sum + quantity(item.quantity), 0)} pcs)`;
}

function deriveOrderPaymentStatus(items) {
  if (!items.length) return 'Pending';
  if (items.every((item) => item.paymentStatus === 'Paid')) return 'Paid';
  if (items.every((item) => item.paymentStatus === 'Pending')) return 'Pending';
  return 'Partial';
}

function getPaidItemTotals(items) {
  return items
    .filter((item) => item.paymentStatus === 'Paid')
    .reduce(
      (acc, item) => ({
        totalAmount: acc.totalAmount + money(item.totalAmount),
        profit: acc.profit + money(item.profit),
      }),
      { totalAmount: 0, profit: 0 }
    );
}

function getCompatibilityFields(items) {
  const firstItem = items[0] || {};
  return {
    sareeBrand: firstItem.sareeBrand || '',
    materialType: firstItem.materialType || '',
    sareeColor: firstItem.sareeColor || '',
    inventoryItemId: firstItem.inventoryItemId || '',
    itemPrice: money(firstItem.itemPrice),
    costPrice: money(firstItem.costPrice),
  };
}

function normalizeOrderForResponse(order) {
  const items = normalizeOrderItems(order);
  const totals = getOrderTotals(items);
  return {
    ...order,
    schemaVersion: order.schemaVersion || 1,
    items,
    ...getCompatibilityFields(items),
    quantity: totals.quantity,
    discount: totals.discount,
    totalAmount: totals.totalAmount,
    profit: totals.profit,
    paymentStatus: deriveOrderPaymentStatus(items),
    itemCount: items.length,
    itemSummary: order.itemSummary || buildItemSummary(items),
  };
}

function buildSubmittedItems(bodyData) {
  const rawItems = Array.isArray(bodyData.items) && bodyData.items.length > 0
    ? bodyData.items
    : [legacyItemFromOrder(bodyData)];

  return rawItems.map((item, index) => normalizeLineItem(item, index, bodyData.paymentStatus));
}

function buildOrderData(bodyData, items, timestamps = {}) {
  const totals = getOrderTotals(items);
  const now = new Date().toISOString();

  return {
    schemaVersion: 2,
    customerName: bodyData.customerName,
    phone: bodyData.phone,
    address: bodyData.address,
    platform: bodyData.platform,
    customerStatus: bodyData.customerStatus || 'New',
    orderPlacedDate: bodyData.orderPlacedDate || timestamps.defaultOrderPlacedDate || '',
    paymentStatus: deriveOrderPaymentStatus(items),
    paymentMode: bodyData.paymentMode,
    itemStatus: bodyData.itemStatus,
    inventoryStatus: bodyData.inventoryStatus || 'Reserved',
    expectedDeliveryDate: bodyData.expectedDeliveryDate || '',
    orderDeliveredDate: bodyData.orderDeliveredDate || '',
    notes: bodyData.notes || '',
    items,
    ...getCompatibilityFields(items),
    quantity: totals.quantity,
    discount: totals.discount,
    totalAmount: totals.totalAmount,
    profit: totals.profit,
    itemCount: items.length,
    itemSummary: buildItemSummary(items),
    updatedAt: now,
    ...(timestamps.createdAt ? { createdAt: timestamps.createdAt } : {}),
  };
}

function getLinkedInventoryIds(items) {
  return [...new Set(items.map((item) => item.inventoryItemId).filter(Boolean))];
}

module.exports = {
  money,
  quantity,
  normalizePaymentStatus,
  deriveOrderPaymentStatus,
  getPaidItemTotals,
  normalizeOrderItems,
  normalizeOrderForResponse,
  buildSubmittedItems,
  buildOrderData,
  getLinkedInventoryIds,
};
