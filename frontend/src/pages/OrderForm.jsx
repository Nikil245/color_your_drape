import { useState, useEffect, useMemo } from 'react';
import { ordersAPI, inventoryAPI } from '../services/api';
import { useToast } from '../components/Toast';

const createEmptyItem = () => ({
  lineItemId: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  sareeBrand: '',
  materialType: '',
  sareeColor: '',
  inventoryItemId: '',
  quantity: 1,
  itemPrice: '',
  costPrice: '',
  discount: 0,
  paymentStatus: 'Pending',
});

const createEmptyOrder = () => ({
  customerName: '',
  phone: '',
  address: '',
  platform: 'Instagram',
  customerStatus: 'New',
  orderPlacedDate: new Date().toISOString().split('T')[0],
  paymentMode: 'UPI',
  itemStatus: 'Confirmed',
  inventoryStatus: 'Reserved',
  expectedDeliveryDate: '',
  orderDeliveredDate: '',
  notes: '',
  items: [createEmptyItem()],
});

function normalizeDraft(savedData) {
  const base = createEmptyOrder();
  if (!savedData || typeof savedData !== 'object') return base;

  const items = Array.isArray(savedData.items) && savedData.items.length > 0
    ? savedData.items
    : [{
      lineItemId: savedData.lineItemId,
      sareeBrand: savedData.sareeBrand,
      materialType: savedData.materialType,
      sareeColor: savedData.sareeColor,
      inventoryItemId: savedData.inventoryItemId,
      quantity: savedData.quantity,
      itemPrice: savedData.itemPrice,
      costPrice: savedData.costPrice,
      discount: savedData.discount,
      paymentStatus: savedData.paymentStatus,
    }];

  return {
    ...base,
    ...savedData,
    items: items.map((item) => ({
      ...createEmptyItem(),
      ...item,
      lineItemId: item.lineItemId || createEmptyItem().lineItemId,
      quantity: item.quantity || 1,
      discount: item.discount || 0,
      paymentStatus: item.paymentStatus || savedData.paymentStatus || 'Pending',
    })),
  };
}

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

function calcItemTotal(item) {
  const q = Number(item.quantity) || 0;
  const p = Number(item.itemPrice) || 0;
  const d = Number(item.discount) || 0;
  return p * q - d;
}

export default function OrderForm() {
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('orderFormDraft');
    if (saved) {
      try {
        return normalizeDraft(JSON.parse(saved));
      } catch {
        return createEmptyOrder();
      }
    }
    return createEmptyOrder();
  });
  const [saving, setSaving] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    localStorage.setItem('orderFormDraft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await inventoryAPI.list();
        setInventoryItems(res.data.items || []);
      } catch { /* silent */ }
    };
    fetchInventory();
  }, []);

  const availableItems = useMemo(() => {
    const flattened = [];
    inventoryItems.forEach((i) => {
      const brand = (i.brandName || '').trim();
      const parentMaterial = (i.materialType || '').trim();

      if (Array.isArray(i.variants) && i.variants.length > 0) {
        i.variants.forEach((v) => {
          const vQty = Number(v.quantity || 0);
          const vSold = Number(v.quantitySold || 0);
          const vRemaining = vQty - vSold;
          if (vRemaining > 0) {
            const variantMaterial = (v.material || '').trim() || parentMaterial;
            flattened.push({
              ...i,
              brandName: brand,
              sareeColor: (v.color || '').trim(),
              materialType: variantMaterial,
              variantQuantity: vQty,
              variantQuantitySold: vSold,
              variantQuantityRemaining: vRemaining,
              purchasePrice: v.purchasePrice ?? i.purchasePrice,
              sellingPrice: v.sellingPrice ?? i.sellingPrice,
            });
          }
        });
      } else {
        const received = i.totalQuantity ?? i.quantityReceived ?? 0;
        const remaining = received - (i.quantitySold || 0);
        if (remaining > 0) {
          flattened.push({
            ...i,
            brandName: brand,
            sareeColor: (i.sareeColor || '').trim(),
            materialType: parentMaterial,
            variantQuantity: received,
            variantQuantitySold: i.quantitySold || 0,
            variantQuantityRemaining: remaining,
          });
        }
      }
    });
    return flattened;
  }, [inventoryItems]);

  const brandOptions = useMemo(() =>
    [...new Set(availableItems.map((i) => (i.brandName || '').trim()).filter(Boolean))].sort(),
    [availableItems]
  );

  const getMaterialTypeOptions = (item) => {
    if (!item.sareeBrand) return [];
    const selectedBrandNorm = item.sareeBrand.trim().toLowerCase();
    const types = availableItems
      .filter((i) => (i.brandName || '').trim().toLowerCase() === selectedBrandNorm)
      .map((i) => (i.materialType || '').trim() || 'Unspecified');
    return [...new Set(types)].sort();
  };

  const getColorOptions = (item) => {
    if (!item.sareeBrand || !item.materialType) return [];
    const selectedBrandNorm = item.sareeBrand.trim().toLowerCase();
    const selectedMaterial = item.materialType.trim();
    const selectedMaterialNorm = selectedMaterial.toLowerCase();

    return availableItems
      .filter((i) => {
        const itemBrandNorm = (i.brandName || '').trim().toLowerCase();
        const itemMaterial = (i.materialType || '').trim();
        const itemMaterialNorm = itemMaterial.toLowerCase();
        const brandMatches = itemBrandNorm === selectedBrandNorm;
        const materialMatches =
          selectedMaterialNorm === 'unspecified'
            ? !itemMaterial || itemMaterial === ''
            : itemMaterialNorm === selectedMaterialNorm;

        return brandMatches && materialMatches;
      })
      .map((i) => ({
        id: i.id,
        color: i.sareeColor,
        material: i.materialType,
        remaining: i.variantQuantityRemaining ?? ((i.totalQuantity ?? i.quantityReceived ?? 0) - (i.quantitySold || 0)),
        sellingPrice: i.sellingPrice,
        purchasePrice: i.purchasePrice,
      }))
      .filter((c) => c.remaining > 0);
  };

  const getSelectedStock = (item) => {
    const colorNorm = (item.sareeColor || '').trim().toLowerCase();
    const match = getColorOptions(item).find((c) => (c.color || '').trim().toLowerCase() === colorNorm);
    return match ? match.remaining : null;
  };

  const handleChange = (field, value) => {
    setFormData((p) => ({ ...p, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((p) => {
      const items = p.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const next = { ...item, [field]: value };

        if (field === 'sareeBrand') {
          next.materialType = '';
          next.sareeColor = '';
          next.inventoryItemId = '';
          next.itemPrice = '';
          next.costPrice = '';
        }

        if (field === 'materialType') {
          next.sareeColor = '';
          next.inventoryItemId = '';
          next.itemPrice = '';
          next.costPrice = '';
        }

        if (field === 'sareeColor') {
          const valNorm = (value || '').trim().toLowerCase();
          const match = getColorOptions(next).find((c) => (c.color || '').trim().toLowerCase() === valNorm);
          if (match) {
            next.inventoryItemId = match.id;
            next.itemPrice = match.sellingPrice ?? '';
            next.costPrice = match.purchasePrice ?? '';
          } else {
            next.inventoryItemId = '';
            next.itemPrice = '';
            next.costPrice = '';
          }
        }

        return next;
      });

      return { ...p, items };
    });
  };

  const addItem = () => {
    setFormData((p) => ({ ...p, items: [...p.items, createEmptyItem()] }));
  };

  const removeItem = (index) => {
    setFormData((p) => {
      if (p.items.length <= 1) return p;
      return { ...p, items: p.items.filter((_, itemIndex) => itemIndex !== index) };
    });
  };

  const calcOrderTotal = () => formData.items.reduce((sum, item) => sum + calcItemTotal(item), 0);

  const resetForm = () => {
    setFormData(createEmptyOrder());
    localStorage.removeItem('orderFormDraft');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ordersAPI.create(formData);
      addToast('Order created successfully!', 'success');
      setFormData(createEmptyOrder());
      localStorage.removeItem('orderFormDraft');
      const res = await inventoryAPI.list();
      setInventoryItems(res.data.items || []);
    } catch (err) {
      addToast(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed to create order', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="order-form-card glass-card animate-fade-in">
      <form onSubmit={handleSubmit}>
        <h3 className="section-title" style={{ color: 'var(--color-primary)' }}>Customer Details</h3>
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="Jane Doe" value={formData.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Phone Number</label>
            <input className="form-input" placeholder="+91 98765 43210" value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)} required />
          </div>
          <div className="form-field span-2">
            <label className="form-label">Shipping Address</label>
            <textarea className="form-textarea" rows={3} placeholder="Enter complete address"
              value={formData.address} onChange={(e) => handleChange('address', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Platform</label>
            <select className="form-select" value={formData.platform}
              onChange={(e) => handleChange('platform', e.target.value)}>
              <option>Instagram</option><option>WhatsApp</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Customer Status</label>
            <select className="form-select" value={formData.customerStatus}
              onChange={(e) => handleChange('customerStatus', e.target.value)}>
              <option>New</option><option>Repeat</option><option>VIP</option>
            </select>
          </div>
        </div>

        <div className="item-section-heading">
          <h3 className="section-title" style={{ color: 'var(--color-primary)', marginTop: 48 }}>Item Details</h3>
          <button type="button" className="btn-secondary add-saree-btn" onClick={addItem}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            Add Another Saree
          </button>
        </div>

        <div className="order-items-list">
          {formData.items.map((item, index) => {
            const materialTypeOptions = getMaterialTypeOptions(item);
            const colorOptions = getColorOptions(item);
            const selectedStock = getSelectedStock(item);

            return (
              <section className="order-item-block" key={item.lineItemId}>
                <div className="order-item-header">
                  <h4>Saree {index + 1}</h4>
                  {formData.items.length > 1 && (
                    <button type="button" className="order-item-remove" onClick={() => removeItem(index)} title="Remove saree">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  )}
                </div>

                <div className="form-grid item-form-grid">
                  <div className="form-field">
                    <label className="form-label">Saree Brand</label>
                    <select className="form-select" value={item.sareeBrand}
                      onChange={(e) => handleItemChange(index, 'sareeBrand', e.target.value)} required>
                      <option value="">Select Brand</option>
                      {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Material Type</label>
                    <select className="form-select" value={item.materialType}
                      onChange={(e) => handleItemChange(index, 'materialType', e.target.value)}
                      disabled={!item.sareeBrand} required>
                      {!item.sareeBrand ? (
                        <option value="">Select a brand first</option>
                      ) : (
                        <>
                          <option value="">Select Material</option>
                          {materialTypeOptions.map((mt) => <option key={mt} value={mt}>{mt}</option>)}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Saree Color</label>
                    <select className="form-select" value={item.sareeColor}
                      onChange={(e) => handleItemChange(index, 'sareeColor', e.target.value)}
                      disabled={!item.materialType} required>
                      {!item.materialType ? (
                        <option value="">Select material type first</option>
                      ) : (
                        <>
                          <option value="">Select Color</option>
                          {colorOptions.map((c, idx) => (
                            <option key={`${c.id}-${c.color}-${idx}`} value={c.color}>
                              {c.color} ({c.remaining} left)
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    <span className="form-hint stock-hint">
                      {selectedStock !== null && (
                        <span className={selectedStock <= 5 ? 'stock-hint-low' : 'stock-hint-ok'}>
                          {selectedStock} in stock
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Quantity</label>
                    <input type="number" min="1" className="form-input" value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Unit Price (₹)</label>
                    <input type="number" min="0" className="form-input" placeholder="₹" value={item.itemPrice}
                      onChange={(e) => handleItemChange(index, 'itemPrice', e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Cost Price (₹)</label>
                    <input type="number" min="0" className="form-input" placeholder="₹" value={item.costPrice}
                      onChange={(e) => handleItemChange(index, 'costPrice', e.target.value)} required />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Discount Amount (₹)</label>
                    <input type="number" min="0" className="form-input" placeholder="₹" value={item.discount}
                      onChange={(e) => handleItemChange(index, 'discount', e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Payment Status</label>
                    <select className="form-select" value={item.paymentStatus}
                      onChange={(e) => handleItemChange(index, 'paymentStatus', e.target.value)}>
                      <option>Pending</option><option>Partial</option><option>Paid</option>
                    </select>
                  </div>
                  <div className="line-total-pill">
                    <span>Line Total</span>
                    <strong>{formatCurrency(calcItemTotal(item))}</strong>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="form-grid order-shared-grid">
          <div className="span-2 total-amount-block">
            <span className="text-headline-sm">Total Amount</span>
            <span className="text-display-lg" style={{ color: 'var(--color-secondary)' }}>{formatCurrency(calcOrderTotal())}</span>
          </div>
          <div className="form-field">
            <label className="form-label">Order Date</label>
            <input type="date" className="form-input" value={formData.orderPlacedDate}
              onChange={(e) => handleChange('orderPlacedDate', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Payment Mode</label>
            <select className="form-select" value={formData.paymentMode}
              onChange={(e) => handleChange('paymentMode', e.target.value)}>
              <option>UPI</option><option>Bank Transfer</option><option>COD</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Item Status</label>
            <select className="form-select" value={formData.itemStatus}
              onChange={(e) => handleChange('itemStatus', e.target.value)}>
              <option>Confirmed</option><option>Packed</option><option>Shipped</option>
              <option>Delivered</option><option>Returned</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Expected Delivery</label>
            <input type="date" className="form-input" value={formData.expectedDeliveryDate}
              onChange={(e) => handleChange('expectedDeliveryDate', e.target.value)} />
          </div>
          <div className="form-field span-2">
            <label className="form-label">Special Notes / Weaving Instructions</label>
            <textarea className="form-textarea" rows={3} placeholder="e.g., Extra tassels on pallu..."
              value={formData.notes} onChange={(e) => handleChange('notes', e.target.value)} />
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={resetForm}>Reset Form</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
