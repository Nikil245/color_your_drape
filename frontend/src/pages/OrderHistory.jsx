import { useState, useEffect } from 'react';
import { ordersAPI } from '../services/api';
import { useToast } from '../components/Toast';

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

const statusBadge = (s) => {
  const m = { Delivered: 'badge-delivered', Shipped: 'badge-shipped', Confirmed: 'badge-confirmed', Packed: 'badge-packed', Returned: 'badge-returned' };
  return m[s] || 'badge-pending';
};
const payBadge = (s) => {
  const m = { Paid: 'badge-paid', Pending: 'badge-pending', Partial: 'badge-partial' };
  return m[s] || 'badge-pending';
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', payment: '', platform: '' });
  const [editDrawer, setEditDrawer] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { search };
      if (filters.status) params.status = filters.status;
      if (filters.payment) params.payment = filters.payment;
      if (filters.platform) params.platform = filters.platform;
      const res = await ordersAPI.list(params);
      setOrders(res.data.orders);
    } catch { addToast('Failed to fetch orders', 'error'); }
    finally { setLoading(false); }
  };

  const openEdit = (o) => {
    setEditDrawer(o);
    setEditData({
      customerName: o.customerName, phone: o.phone, address: o.address,
      platform: o.platform, customerStatus: o.customerStatus || 'New',
      sareeBrand: o.sareeBrand, materialType: o.materialType || '',
      sareeColor: o.sareeColor || '', inventoryItemId: o.inventoryItemId || '',
      orderPlacedDate: o.orderPlacedDate || '',
      quantity: o.quantity, itemPrice: o.itemPrice, costPrice: o.costPrice,
      discount: o.discount || 0, paymentStatus: o.paymentStatus,
      paymentMode: o.paymentMode, itemStatus: o.itemStatus,
      inventoryStatus: o.inventoryStatus || 'Reserved',
      expectedDeliveryDate: o.expectedDeliveryDate || '',
      orderDeliveredDate: o.orderDeliveredDate || '', notes: o.notes || '',
    });
  };

  const handleEditChange = (f, v) => setEditData((p) => ({ ...p, [f]: v }));

  const calcTotal = (d) => {
    const q = Number(d.quantity) || 0, p = Number(d.itemPrice) || 0, disc = Number(d.discount) || 0;
    return p * q - disc;
  };

  const saveEdit = async () => {
    if (!editDrawer) return;
    setSaving(true);
    try {
      await ordersAPI.update(editDrawer.id, editData);
      addToast('Order updated!', 'success');
      setEditDrawer(null);
      fetchOrders();
    } catch (err) {
      addToast(err.response?.data?.errors?.[0]?.msg || 'Failed to update', 'error');
    } finally { setSaving(false); }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try { await ordersAPI.delete(id); addToast('Deleted', 'success'); fetchOrders(); }
    catch { addToast('Failed to delete', 'error'); }
  };

  return (
    <div className="order-history animate-fade-in">
      {/* Filters */}
      <div className="history-filters">
        <div className="search-wrap">
          <span className="material-symbols-outlined search-icon">search</span>
          <input className="search-input" placeholder="Search by customer name or Order ID"
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchOrders()} />
        </div>
        <div className="filter-selects">
          <select className="filter-select" value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
            <option value="">Order Status</option>
            <option>Confirmed</option><option>Packed</option><option>Shipped</option>
            <option>Delivered</option><option>Returned</option>
          </select>
          <select className="filter-select" value={filters.payment}
            onChange={(e) => setFilters((p) => ({ ...p, payment: e.target.value }))}>
            <option value="">Payment</option><option>Paid</option><option>Pending</option><option>Partial</option>
          </select>
          <select className="filter-select" value={filters.platform}
            onChange={(e) => setFilters((p) => ({ ...p, platform: e.target.value }))}>
            <option value="">Platform</option><option>Instagram</option><option>WhatsApp</option>
          </select>
          <button className="btn-secondary" onClick={fetchOrders} style={{ padding: '8px 20px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span> Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">receipt_long</span>
          <p>No orders found.</p>
        </div>
      ) : (
        <>
        {/* Desktop Table */}
        <div className="history-table-wrap glass-card heritage-border history-desktop-only">
          <div className="history-table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Order ID</th><th>Customer</th><th>Phone</th><th>Collection</th>
                  <th>Qty</th><th>Total</th><th>Payment</th><th>Status</th>
                  <th>Date</th><th>Delivery</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="order-id-cell">#{o.orderId}</td>
                    <td>{o.customerName}</td>
                    <td>{o.phone}</td>
                    <td>{o.sareeBrand}{o.sareeColor ? ` - ${o.sareeColor}` : ''}</td>
                    <td style={{ textAlign: 'center' }}>{o.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.totalAmount)}</td>
                    <td><span className={`badge ${payBadge(o.paymentStatus)}`}>{o.paymentStatus}</span></td>
                    <td><span className={`badge ${statusBadge(o.itemStatus)}`}>{o.itemStatus}</span></td>
                    <td className="date-cell">{o.orderPlacedDate}</td>
                    <td className="date-cell">{o.expectedDeliveryDate || '—'}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" onClick={() => openEdit(o)} title="Edit">
                          <span className="material-symbols-outlined">edit_note</span>
                        </button>
                        <button className="action-btn action-btn-delete" onClick={() => deleteOrder(o.id)} title="Delete">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="history-mobile-cards">
          {orders.map((o) => (
            <div key={o.id} className="mobile-order-card glass-card" onClick={() => openEdit(o)}>
              <div className="mobile-card-header">
                <span className="mobile-card-order-id">#{o.orderId}</span>
                <span className={`badge ${statusBadge(o.itemStatus)}`}>{o.itemStatus}</span>
              </div>
              <div className="mobile-card-customer">{o.customerName}</div>
              <div className="mobile-card-phone">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>call</span>
                {o.phone}
              </div>
              <div className="mobile-card-saree">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>checkroom</span>
                {o.sareeBrand}{o.sareeColor ? ` — ${o.sareeColor}` : ''}
              </div>
              <div className="mobile-card-row">
                <div className="mobile-card-detail">
                  <span className="mobile-card-detail-label">Qty</span>
                  <span className="mobile-card-detail-value">{o.quantity}</span>
                </div>
                <div className="mobile-card-detail">
                  <span className="mobile-card-detail-label">Total</span>
                  <span className="mobile-card-detail-value mobile-card-total">{formatCurrency(o.totalAmount)}</span>
                </div>
                <div className="mobile-card-detail">
                  <span className="mobile-card-detail-label">Payment</span>
                  <span className={`badge ${payBadge(o.paymentStatus)}`}>{o.paymentStatus}</span>
                </div>
              </div>
              <div className="mobile-card-footer">
                <span className="mobile-card-date">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                  {o.orderPlacedDate}
                </span>
                {o.expectedDeliveryDate && (
                  <span className="mobile-card-date">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>local_shipping</span>
                    {o.expectedDeliveryDate}
                  </span>
                )}
                <button className="mobile-card-edit-btn" onClick={(e) => { e.stopPropagation(); openEdit(o); }} title="Edit">
                  <span className="material-symbols-outlined">edit_note</span>
                </button>
              </div>
            </div>
          ))}
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
                Order Details - #{editDrawer.orderId}
              </h3>
              <button className="drawer-close" onClick={() => setEditDrawer(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="drawer-body">
              <section className="drawer-section">
                <h4 className="drawer-section-title">Customer Details</h4>
                <div className="drawer-fields">
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Full Name</label>
                    <input className="form-input drawer-input" value={editData.customerName}
                      onChange={(e) => handleEditChange('customerName', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Phone</label>
                    <input className="form-input drawer-input" value={editData.phone}
                      onChange={(e) => handleEditChange('phone', e.target.value)} /></div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}><label className="form-label" style={{fontSize:12}}>Address</label>
                    <textarea className="form-textarea drawer-input" rows={2} value={editData.address}
                      onChange={(e) => handleEditChange('address', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Payment Status</label>
                    <select className="form-select drawer-input" value={editData.paymentStatus}
                      onChange={(e) => handleEditChange('paymentStatus', e.target.value)}>
                      <option>Paid</option><option>Pending</option><option>Partial</option></select></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Item Status</label>
                    <select className="form-select drawer-input" value={editData.itemStatus}
                      onChange={(e) => handleEditChange('itemStatus', e.target.value)}>
                      <option>Confirmed</option><option>Packed</option><option>Shipped</option>
                      <option>Delivered</option><option>Returned</option></select></div>
                </div>
              </section>
              <section className="drawer-section">
                <h4 className="drawer-section-title">Item Details</h4>
                <div className="drawer-fields">
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}><label className="form-label" style={{fontSize:12}}>Saree Brand</label>
                    <input className="form-input drawer-input" value={editData.sareeBrand}
                      onChange={(e) => handleEditChange('sareeBrand', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Quantity</label>
                    <input type="number" className="form-input drawer-input" value={editData.quantity}
                      onChange={(e) => handleEditChange('quantity', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Unit Price (₹)</label>
                    <input type="number" className="form-input drawer-input" value={editData.itemPrice}
                      onChange={(e) => handleEditChange('itemPrice', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Cost Price (₹)</label>
                    <input type="number" className="form-input drawer-input" value={editData.costPrice}
                      onChange={(e) => handleEditChange('costPrice', e.target.value)} /></div>
                  <div className="drawer-field"><label className="form-label" style={{fontSize:12}}>Discount (₹)</label>
                    <input type="number" className="form-input drawer-input" value={editData.discount}
                      onChange={(e) => handleEditChange('discount', e.target.value)} /></div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" style={{fontSize:12}}>Total Amount</label>
                    <div className="total-display">{formatCurrency(calcTotal(editData))}</div>
                  </div>
                  <div className="drawer-field" style={{gridColumn:'1/-1'}}><label className="form-label" style={{fontSize:12}}>Notes</label>
                    <textarea className="form-textarea drawer-input" rows={2} value={editData.notes}
                      onChange={(e) => handleEditChange('notes', e.target.value)} /></div>
                </div>
              </section>
            </div>
            <div className="drawer-footer">
              <button className="btn-secondary" onClick={() => setEditDrawer(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
