import { useState, useEffect, useMemo } from 'react';
import { ordersAPI, inventoryAPI } from '../services/api';
import { useToast } from '../components/Toast';

const emptyOrder = {
  customerName: '', phone: '', address: '', platform: 'Instagram',
  customerStatus: 'New', sareeBrand: '', materialType: '', sareeColor: '',
  inventoryItemId: '',
  orderPlacedDate: new Date().toISOString().split('T')[0], quantity: 1,
  itemPrice: '', costPrice: '', discount: 0, paymentStatus: 'Pending',
  paymentMode: 'UPI', itemStatus: 'Confirmed', inventoryStatus: 'Reserved',
  expectedDeliveryDate: '', orderDeliveredDate: '', notes: '',
};

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

export default function OrderForm() {
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('orderFormDraft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { ...emptyOrder };
      }
    }
    return { ...emptyOrder };
  });
  const [saving, setSaving] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    localStorage.setItem('orderFormDraft', JSON.stringify(formData));
  }, [formData]);

  // Fetch all inventory items on mount
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const res = await inventoryAPI.list();
        setInventoryItems(res.data.items || []);
      } catch { /* silent */ }
    };
    fetchInventory();
  }, []);

  // ─── Derived dropdown options ───

  // Available items (only those with remaining stock > 0)
  const availableItems = useMemo(() =>
    inventoryItems.filter((i) => {
      const remaining = (i.quantityReceived || 0) - (i.quantitySold || 0);
      return remaining > 0;
    }),
    [inventoryItems]
  );

  // Unique brands from available items, sorted — trim to avoid whitespace duplicates
  const brandOptions = useMemo(() =>
    [...new Set(availableItems.map((i) => (i.brandName || '').trim()).filter(Boolean))].sort(),
    [availableItems]
  );

  // Material types for the selected brand (only from available items)
  // If old records have no materialType, show them under "Unspecified"
  const materialTypeOptions = useMemo(() => {
    if (!formData.sareeBrand) return [];
    const types = availableItems
      .filter((i) => (i.brandName || '').trim() === formData.sareeBrand)
      .map((i) => (i.materialType || '').trim() || 'Unspecified');
    return [...new Set(types)].sort();
  }, [availableItems, formData.sareeBrand]);

  // Saree colors for the selected brand + materialType (with stock info)
  const colorOptions = useMemo(() => {
    if (!formData.sareeBrand || !formData.materialType) return [];
    const selectedType = formData.materialType;
    return availableItems
      .filter(
        (i) =>
          (i.brandName || '').trim() === formData.sareeBrand &&
          // Match "Unspecified" to items with empty/missing materialType
          (selectedType === 'Unspecified'
            ? !i.materialType || i.materialType.trim() === ''
            : (i.materialType || '').trim() === selectedType)
      )
      .map((i) => ({
        id: i.id,
        color: i.sareeColor,
        remaining: (i.quantityReceived || 0) - (i.quantitySold || 0),
        sellingPrice: i.sellingPrice,
        purchasePrice: i.purchasePrice,
      }));
  }, [availableItems, formData.sareeBrand, formData.materialType]);

  const handleChange = (field, value) => {
    setFormData((p) => {
      const next = { ...p, [field]: value };

      // Cascade reset: when brand changes, clear material type + color + inventory link
      if (field === 'sareeBrand') {
        next.materialType = '';
        next.sareeColor = '';
        next.inventoryItemId = '';
      }
      // When material type changes, clear color + inventory link
      if (field === 'materialType') {
        next.sareeColor = '';
        next.inventoryItemId = '';
      }
      // When color changes, auto-link to inventory item and pre-fill prices
      if (field === 'sareeColor') {
        const match = colorOptions.find((c) => c.color === value);
        if (match) {
          next.inventoryItemId = match.id;
          // Auto-fill selling/cost price from inventory if not already set
          if (!p.itemPrice || p.itemPrice === '') {
            next.itemPrice = match.sellingPrice || '';
          }
          if (!p.costPrice || p.costPrice === '') {
            next.costPrice = match.purchasePrice || '';
          }
        } else {
          next.inventoryItemId = '';
        }
      }
      return next;
    });
  };

  const calcTotal = () => {
    const q = Number(formData.quantity) || 0;
    const p = Number(formData.itemPrice) || 0;
    const d = Number(formData.discount) || 0;
    return p * q - d;
  };

  // Find the selected inventory item's remaining stock for display
  const selectedStock = useMemo(() => {
    const match = colorOptions.find((c) => c.color === formData.sareeColor);
    return match ? match.remaining : null;
  }, [colorOptions, formData.sareeColor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ordersAPI.create(formData);
      addToast('Order created successfully!', 'success');
      setFormData({ ...emptyOrder });
      localStorage.removeItem('orderFormDraft');
      // Refresh inventory data (stock levels changed)
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

        <h3 className="section-title" style={{ color: 'var(--color-primary)', marginTop: 48 }}>Item Details</h3>
        <div className="form-grid">
          {/* Saree Brand — Dropdown from inventory */}
          <div className="form-field">
            <label className="form-label">Saree Brand</label>
            <select className="form-select" value={formData.sareeBrand}
              onChange={(e) => handleChange('sareeBrand', e.target.value)} required>
              <option value="">— Select Brand —</option>
              {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Material Type — Dependent dropdown */}
          <div className="form-field">
            <label className="form-label">Material Type</label>
            <select className="form-select" value={formData.materialType}
              onChange={(e) => handleChange('materialType', e.target.value)}
              disabled={!formData.sareeBrand} required>
              {!formData.sareeBrand ? (
                <option value="">Select a brand first</option>
              ) : (
                <>
                  <option value="">— Select Material —</option>
                  {materialTypeOptions.map((mt) => <option key={mt} value={mt}>{mt}</option>)}
                </>
              )}
            </select>
          </div>

          {/* Saree Color — Dependent dropdown with stock info */}
          <div className="form-field">
            <label className="form-label">Saree Color</label>
            <select className="form-select" value={formData.sareeColor}
              onChange={(e) => handleChange('sareeColor', e.target.value)}
              disabled={!formData.materialType} required>
              {!formData.materialType ? (
                <option value="">Select material type first</option>
              ) : (
                <>
                  <option value="">— Select Color —</option>
                  {colorOptions.map((c) => (
                    <option key={c.id} value={c.color}>
                      {c.color} ({c.remaining} left)
                    </option>
                  ))}
                </>
              )}
            </select>
            {selectedStock !== null && (
              <span className="form-hint" style={{
                marginTop: 4, fontSize: 12,
                color: selectedStock <= 5 ? 'var(--color-error)' : 'var(--color-tertiary)',
                fontWeight: 600
              }}>
                {selectedStock} in stock
              </span>
            )}
          </div>

          <div className="form-field">
            <label className="form-label">Order Date</label>
            <input type="date" className="form-input" value={formData.orderPlacedDate}
              onChange={(e) => handleChange('orderPlacedDate', e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">Quantity</label>
            <input type="number" min="1" className="form-input" value={formData.quantity}
              onChange={(e) => handleChange('quantity', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Unit Price (₹)</label>
            <input type="number" min="0" className="form-input" placeholder="₹" value={formData.itemPrice}
              onChange={(e) => handleChange('itemPrice', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Cost Price (₹)</label>
            <input type="number" min="0" className="form-input" placeholder="₹" value={formData.costPrice}
              onChange={(e) => handleChange('costPrice', e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="form-label">Discount Amount (₹)</label>
            <input type="number" min="0" className="form-input" placeholder="₹" value={formData.discount}
              onChange={(e) => handleChange('discount', e.target.value)} />
          </div>
          <div className="span-2 total-amount-block">
            <span className="text-headline-sm">Total Amount</span>
            <span className="text-display-lg" style={{ color: 'var(--color-secondary)' }}>{formatCurrency(calcTotal())}</span>
          </div>
          <div className="form-field">
            <label className="form-label">Payment Status</label>
            <select className="form-select" value={formData.paymentStatus}
              onChange={(e) => handleChange('paymentStatus', e.target.value)}>
              <option>Pending</option><option>Partial</option><option>Paid</option>
            </select>
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
          <button type="button" className="btn-secondary" onClick={() => {
            setFormData({ ...emptyOrder });
            localStorage.removeItem('orderFormDraft');
          }}>Reset Form</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
