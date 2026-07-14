import { useState, useEffect } from 'react';
import { inventoryAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './Inventory.css';

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

function deriveStatus(remaining) {
  if (remaining <= 0) return 'Out of Stock';
  if (remaining <= 5) return 'Low Stock';
  return 'In Stock';
}

const statusBadgeClass = (status) => {
  if (status === 'In Stock') return 'badge-in-stock';
  if (status === 'Low Stock') return 'badge-low-stock';
  return 'badge-out-of-stock';
};

const emptyForm = {
  stockReceivedDate: new Date().toISOString().split('T')[0],
  brandName: '', sareeColor: '', materialType: '', quantityReceived: '',
  purchasePrice: '', sellingPrice: '', supplierName: '',
  supplierPhone: '', supplierAddress: '', remarks: '',
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', brand: '' });
  const [brands, setBrands] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  // Edit drawer state
  const [editDrawer, setEditDrawer] = useState(null);
  const [editData, setEditData] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => { fetchItems(); fetchBrands(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = { search };
      if (filters.status) params.status = filters.status;
      if (filters.brand) params.brand = filters.brand;
      const res = await inventoryAPI.list(params);
      setItems(res.data.items);
    } catch { addToast('Failed to fetch inventory', 'error'); }
    finally { setLoading(false); }
  };

  const fetchBrands = async () => {
    try {
      const res = await inventoryAPI.brands();
      setBrands(res.data.brands || []);
    } catch { /* silent */ }
  };

  const handleFormChange = (f, v) => setFormData((p) => ({ ...p, [f]: v }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventoryAPI.create(formData);
      addToast('Stock entry added!', 'success');
      setFormData({ ...emptyForm });
      setShowForm(false);
      fetchItems();
      fetchBrands();
    } catch (err) {
      addToast(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed to add stock', 'error');
    } finally { setSaving(false); }
  };

  // ─── Edit drawer ───
  const openEdit = (item) => {
    setEditDrawer(item);
    setEditData({
      stockReceivedDate: item.stockReceivedDate || '',
      brandName: item.brandName, sareeColor: item.sareeColor,
      materialType: item.materialType || '',
      quantityReceived: item.quantityReceived,
      quantitySold: item.quantitySold || 0,
      purchasePrice: item.purchasePrice, sellingPrice: item.sellingPrice,
      supplierName: item.supplierName,
      supplierPhone: item.supplierPhone || '',
      supplierAddress: item.supplierAddress || '',
      remarks: item.remarks || '',
    });
  };
  const handleEditChange = (f, v) => setEditData((p) => ({ ...p, [f]: v }));

  const saveEdit = async () => {
    if (!editDrawer) return;
    setEditSaving(true);
    try {
      await inventoryAPI.update(editDrawer.id, editData);
      addToast('Inventory updated!', 'success');
      setEditDrawer(null);
      fetchItems();
      fetchBrands();
    } catch (err) {
      addToast(err.response?.data?.errors?.[0]?.msg || 'Failed to update', 'error');
    } finally { setEditSaving(false); }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this inventory item?')) return;
    try { await inventoryAPI.delete(id); addToast('Deleted', 'success'); fetchItems(); }
    catch { addToast('Failed to delete', 'error'); }
  };

  return (
    <div className="inventory-page animate-fade-in">
      {/* Header */}
      <div className="inventory-header">
        <div className="inventory-header-text">
          <h1 className="text-headline-md" style={{ color: 'var(--color-on-surface)' }}>
            Inventory Management
          </h1>
          <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
            Track saree stock levels, suppliers, and pricing.
          </p>
        </div>
        <button className="btn-primary inventory-add-btn" onClick={() => setShowForm(!showForm)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {showForm ? 'close' : 'add'}
          </span>
          {showForm ? 'Cancel' : 'Add Stock'}
        </button>
      </div>

      {/* Add Stock Form */}
      {showForm && (
        <div className="inventory-form-panel glass-card heritage-border">
          <h3 className="section-title" style={{ color: 'var(--color-primary)' }}>New Stock Entry</h3>
          <form onSubmit={handleCreate}>
            <div className="inventory-form-grid">
              <div className="form-field">
                <label className="form-label">Stock Received Date</label>
                <input type="date" className="form-input" value={formData.stockReceivedDate}
                  onChange={(e) => handleFormChange('stockReceivedDate', e.target.value)} />
              </div>
              <div className="form-field">
                <label className="form-label">Brand Name</label>
                <input className="form-input" placeholder="e.g., JK Crape" value={formData.brandName}
                  onChange={(e) => handleFormChange('brandName', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Saree Color</label>
                <input className="form-input" placeholder="e.g., Maroon, Teal Blue" value={formData.sareeColor}
                  onChange={(e) => handleFormChange('sareeColor', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Material Type</label>
                <input className="form-input" placeholder="e.g., Pure Silk, Cotton" value={formData.materialType}
                  onChange={(e) => handleFormChange('materialType', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Quantity Received</label>
                <input type="number" min="0" className="form-input" placeholder="0" value={formData.quantityReceived}
                  onChange={(e) => handleFormChange('quantityReceived', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Purchase Price (₹)</label>
                <input type="number" min="0" className="form-input" placeholder="₹" value={formData.purchasePrice}
                  onChange={(e) => handleFormChange('purchasePrice', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Selling Price (₹)</label>
                <input type="number" min="0" className="form-input" placeholder="₹" value={formData.sellingPrice}
                  onChange={(e) => handleFormChange('sellingPrice', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Supplier Name</label>
                <input className="form-input" placeholder="e.g., Silk House Chennai" value={formData.supplierName}
                  onChange={(e) => handleFormChange('supplierName', e.target.value)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Supplier Phone Number</label>
                <input className="form-input" placeholder="+91 98765 43210" value={formData.supplierPhone}
                  onChange={(e) => handleFormChange('supplierPhone', e.target.value)} />
              </div>
              <div className="form-field inv-span-3">
                <label className="form-label">Supplier Address</label>
                <textarea className="form-textarea" rows={2} placeholder="Supplier's full address..."
                  value={formData.supplierAddress} onChange={(e) => handleFormChange('supplierAddress', e.target.value)} />
              </div>
              <div className="form-field inv-span-3">
                <label className="form-label">Remarks (Optional)</label>
                <textarea className="form-textarea" rows={2} placeholder="Any notes about this stock batch..."
                  value={formData.remarks} onChange={(e) => handleFormChange('remarks', e.target.value)} />
              </div>
            </div>
            <div className="inventory-form-actions">
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setFormData({ ...emptyForm }); }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Add Stock Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="inventory-filters">
        <div className="inv-search-wrap">
          <span className="material-symbols-outlined inv-search-icon">search</span>
          <input className="inv-search-input" placeholder="Search by saree color, brand, or supplier"
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchItems()} />
        </div>
        <div className="inv-filter-selects">
          <select className="inv-filter-select" value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            <option value="">All Status</option>
            <option>In Stock</option>
            <option>Low Stock</option>
            <option>Out of Stock</option>
          </select>
          <select className="inv-filter-select" value={filters.brand}
            onChange={(e) => setFilters((p) => ({ ...p, brand: e.target.value }))}>
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b}>{b}</option>)}
          </select>
          <button className="btn-secondary" onClick={fetchItems} style={{ padding: '8px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span> Apply
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">inventory_2</span>
          <p>No inventory items yet. Add your first stock entry!</p>
        </div>
      ) : (
        <>
        {/* Desktop Table */}
        <div className="inventory-table-wrap glass-card heritage-border inventory-desktop-only">
          <div className="inventory-table-scroll">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Brand</th><th>Saree Color</th><th>Material Type</th><th>Received</th>
                  <th>Qty Received</th><th>Qty Sold</th><th>Remaining</th>
                  <th>Status</th><th>Purchase ₹</th><th>Selling ₹</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const remaining = item.quantityReceived - (item.quantitySold || 0);
                  const status = deriveStatus(remaining);
                  const remClass = remaining > 5 ? 'inv-remaining-ok' : remaining > 0 ? 'inv-remaining-low' : 'inv-remaining-out';
                  return (
                    <tr key={item.id}>
                      <td className="inv-name-cell">{item.brandName}</td>
                      <td>{item.sareeColor}</td>
                      <td>{item.materialType || '—'}</td>
                      <td className="date-cell">{item.stockReceivedDate}</td>
                      <td className="inv-qty-cell">{item.quantityReceived}</td>
                      <td className="inv-qty-cell">{item.quantitySold || 0}</td>
                      <td className={`inv-qty-cell ${remClass}`}>{remaining}</td>
                      <td><span className={`badge ${statusBadgeClass(status)}`}>{status}</span></td>
                      <td>{formatCurrency(item.purchasePrice)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(item.sellingPrice)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn" onClick={() => openEdit(item)} title="Edit">
                            <span className="material-symbols-outlined">edit_note</span>
                          </button>
                          <button className="action-btn action-btn-delete" onClick={() => deleteItem(item.id)} title="Delete">
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="inventory-mobile-cards">
          {items.map((item) => {
            const remaining = item.quantityReceived - (item.quantitySold || 0);
            const status = deriveStatus(remaining);
            return (
              <div key={item.id} className="inv-mobile-card glass-card" onClick={() => openEdit(item)}>
                <div className="inv-card-header">
                  <span className="inv-card-name">{item.brandName}</span>
                  <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
                </div>
                <div className="inv-card-brand">{item.sareeColor}{item.materialType ? ` · ${item.materialType}` : ''}</div>
                <div className="inv-card-supplier">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>store</span>
                  {item.supplierName}
                </div>
                <div className="inv-card-stats">
                  <div className="inv-card-stat">
                    <span className="inv-card-stat-label">Received</span>
                    <span className="inv-card-stat-value">{item.quantityReceived}</span>
                  </div>
                  <div className="inv-card-stat">
                    <span className="inv-card-stat-label">Sold</span>
                    <span className="inv-card-stat-value">{item.quantitySold || 0}</span>
                  </div>
                  <div className="inv-card-stat">
                    <span className="inv-card-stat-label">Left</span>
                    <span className="inv-card-stat-value" style={{
                      color: remaining > 5 ? 'var(--color-tertiary)' : remaining > 0 ? 'var(--color-gold)' : 'var(--color-error)'
                    }}>{remaining}</span>
                  </div>
                </div>
                <div className="inv-card-footer">
                  <div className="inv-card-prices">
                    <span>Cost: <span className="inv-card-price-tag">{formatCurrency(item.purchasePrice)}</span></span>
                    <span>Sell: <span className="inv-card-price-tag">{formatCurrency(item.sellingPrice)}</span></span>
                  </div>
                  <button className="inv-card-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(item); }} title="Edit">
                    <span className="material-symbols-outlined">edit_note</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Edit Drawer */}
      {editDrawer && editData && (
        <>
          <div className="drawer-overlay" onClick={() => setEditDrawer(null)} />
          <div className="edit-drawer animate-slide-in">
            <div className="drawer-header">
              <h3 className="text-headline-sm" style={{ color: 'var(--color-primary)' }}>
                Edit — {editDrawer.brandName} · {editDrawer.sareeColor}
              </h3>
              <button className="drawer-close" onClick={() => setEditDrawer(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="drawer-body">
              <section className="drawer-section">
                <h4 className="drawer-section-title">Stock Details</h4>
                <div className="drawer-fields">
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Stock Received Date</label>
                    <input type="date" className="form-input drawer-input" value={editData.stockReceivedDate}
                      onChange={(e) => handleEditChange('stockReceivedDate', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Brand Name</label>
                    <input className="form-input drawer-input" value={editData.brandName}
                      onChange={(e) => handleEditChange('brandName', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Saree Color</label>
                    <input className="form-input drawer-input" value={editData.sareeColor}
                      onChange={(e) => handleEditChange('sareeColor', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Material Type</label>
                    <input className="form-input drawer-input" value={editData.materialType}
                      onChange={(e) => handleEditChange('materialType', e.target.value)} />
                  </div>
                </div>
              </section>
              <section className="drawer-section">
                <h4 className="drawer-section-title">Supplier Details</h4>
                <div className="drawer-fields">
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Supplier Name</label>
                    <input className="form-input drawer-input" value={editData.supplierName}
                      onChange={(e) => handleEditChange('supplierName', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Supplier Phone Number</label>
                    <input className="form-input drawer-input" placeholder="+91 98765 43210" value={editData.supplierPhone}
                      onChange={(e) => handleEditChange('supplierPhone', e.target.value)} />
                  </div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" style={{fontSize:12}}>Supplier Address</label>
                    <textarea className="form-textarea drawer-input" rows={2} placeholder="Supplier's full address..." value={editData.supplierAddress}
                      onChange={(e) => handleEditChange('supplierAddress', e.target.value)} />
                  </div>
                </div>
              </section>
              <section className="drawer-section">
                <h4 className="drawer-section-title">Quantities</h4>
                <div className="drawer-fields">
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Qty Received</label>
                    <input type="number" min="0" className="form-input drawer-input" value={editData.quantityReceived}
                      onChange={(e) => handleEditChange('quantityReceived', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Qty Sold <span style={{color:'var(--color-on-surface-variant)', fontWeight:400}}>(auto-updated from orders)</span></label>
                    <input type="number" min="0" className="form-input drawer-input" value={editData.quantitySold}
                      readOnly disabled style={{opacity:0.6, cursor:'not-allowed'}} />
                  </div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" style={{fontSize:12}}>Remaining (auto-calculated)</label>
                    <div className="total-display">
                      {Number(editData.quantityReceived || 0) - Number(editData.quantitySold || 0)} units
                      {' '}— <span className={`badge ${statusBadgeClass(
                        deriveStatus(Number(editData.quantityReceived || 0) - Number(editData.quantitySold || 0))
                      )}`}>
                        {deriveStatus(Number(editData.quantityReceived || 0) - Number(editData.quantitySold || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
              <section className="drawer-section">
                <h4 className="drawer-section-title">Pricing</h4>
                <div className="drawer-fields">
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Purchase Price (₹)</label>
                    <input type="number" min="0" className="form-input drawer-input" value={editData.purchasePrice}
                      onChange={(e) => handleEditChange('purchasePrice', e.target.value)} />
                  </div>
                  <div className="drawer-field">
                    <label className="form-label" style={{fontSize:12}}>Selling Price (₹)</label>
                    <input type="number" min="0" className="form-input drawer-input" value={editData.sellingPrice}
                      onChange={(e) => handleEditChange('sellingPrice', e.target.value)} />
                  </div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" style={{fontSize:12}}>Remarks</label>
                    <textarea className="form-textarea drawer-input" rows={2} value={editData.remarks}
                      onChange={(e) => handleEditChange('remarks', e.target.value)} />
                  </div>
                </div>
              </section>
            </div>
            <div className="drawer-footer">
              <button className="btn-secondary" onClick={() => setEditDrawer(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
