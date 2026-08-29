import { useState, useEffect } from 'react';
import { customersAPI } from '../services/api';
import './Customers.css';

function formatCurrency(n) {
  if (!n && n !== 0) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN');
}

const statusBadge = (s) => {
  if (s === 'VIP') return 'badge-vip';
  if (s === 'Repeat') return 'badge-repeat';
  return 'badge-new';
};

const payBadge = (s) => {
  const m = { Paid: 'badge-paid', Pending: 'badge-pending', Partial: 'badge-partial' };
  return m[s] || 'badge-pending';
};

const itemBadge = (s) => {
  const m = { Delivered: 'badge-delivered', Shipped: 'badge-shipped', Confirmed: 'badge-confirmed', Packed: 'badge-packed', Returned: 'badge-returned' };
  return m[s] || 'badge-pending';
};

/**
 * Parse an address string into a clean, non-duplicated location display.
 * Returns { line1, line2 } where line2 is only set if it adds new info.
 */
function parseLocation(address) {
  if (!address) return { line1: 'N/A', line2: '' };
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { line1: 'N/A', line2: '' };
  if (parts.length === 1) return { line1: parts[0], line2: '' };
  // For multi-part addresses: show first parts as line1, last part as line2 (only if different)
  const lastPart = parts[parts.length - 1];
  const firstParts = parts.slice(0, -1).join(', ');
  // If last part is already included in the first parts, skip it
  if (firstParts.toLowerCase().includes(lastPart.toLowerCase())) {
    return { line1: firstParts, line2: '' };
  }
  return { line1: firstParts, line2: lastPart };
}

/**
 * Display-friendly phone value — shows a dash if phone is missing/invalid.
 */
function displayPhone(phone) {
  const val = phone?.trim();
  if (!val || val === '-' || val === 'N/A') return '-';
  return val;
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState('all');
  const [availableMonths, setAvailableMonths] = useState([]);

  // Detail drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [detail, setDetail] = useState(null); // { customer, orders }

  useEffect(() => { fetchCustomers(); }, [month]);

  const fetchCustomers = async (targetMonth = month) => {
    setLoading(true);
    try {
      const params = { search };
      if (targetMonth && targetMonth !== 'all') params.month = targetMonth;
      const res = await customersAPI.list(params);
      setCustomers(res.data.customers);
      if (res.data.availableMonths) {
        setAvailableMonths(res.data.availableMonths);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const openCustomerDetail = async (customer) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDetail(null);
    try {
      const res = await customersAPI.getByKey(customer._key);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetail(null);
  };

  const selectedMonthLabel = availableMonths.find((m) => m.value === month)?.label || month;

  return (
    <div className="customers-page animate-fade-in">
      <div className="customers-header">
        <div>
          <h1 className="text-headline-md" style={{ color: 'var(--color-on-surface)' }}>Customer Directory</h1>
          <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
            Manage your client relationships and histories.
          </p>
        </div>
        <div className="customers-actions">
          <div className="customer-search-wrap">
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-on-surface-variant)' }}>search</span>
            <input className="form-input" style={{ paddingLeft: 40 }} placeholder="Search customers..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()} />
          </div>
          <select className="filter-select" value={month}
            onChange={(e) => setMonth(e.target.value)}>
            <option value="all">All Time</option>
            {availableMonths.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={() => fetchCustomers()}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span>
            Filter
          </button>
        </div>
      </div>

      {month !== 'all' && !loading && (
        <div className="cust-month-summary">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>calendar_month</span>
          <span>{customers.length} {customers.length === 1 ? 'customer' : 'customers'} ordered in {selectedMonthLabel}</span>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">group</span>
          <p>No customers found for the selected period.</p>
        </div>
      ) : (
        <div className="customers-list glass-card">
          {/* Desktop Header */}
          <div className="cust-header-row">
            <div className="cust-col-3">Customer Info</div>
            <div className="cust-col-3">Location</div>
            <div className="cust-col-2" style={{ textAlign: 'right' }}>Orders</div>
            <div className="cust-col-2" style={{ textAlign: 'right' }}>Total Spend</div>
            <div className="cust-col-2" style={{ textAlign: 'center' }}>Status</div>
          </div>

          <div className="cust-body">
            {customers.map((c, i) => {
              const loc = parseLocation(c.address);
              return (
                <div key={i} className="cust-row" onClick={() => openCustomerDetail(c)} role="button" tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openCustomerDetail(c)}>
                  <div className="cust-col-3 cust-info">
                    <p className="cust-name">{c.name}</p>
                    <p className="cust-phone">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
                      {displayPhone(c.phone)}
                    </p>
                  </div>
                  <div className="cust-col-3 cust-location">
                    <p>{loc.line1}</p>
                    {loc.line2 && <p className="cust-city">{loc.line2}</p>}
                  </div>
                  <div className="cust-col-2 cust-stat">
                    <span className="mobile-label">Total Orders:</span>
                    <span className="cust-stat-value">{c.totalOrders}</span>
                  </div>
                  <div className="cust-col-2 cust-stat">
                    <span className="mobile-label">Total Spend:</span>
                    <span className="cust-stat-value">{formatCurrency(c.totalSpend)}</span>
                  </div>
                  <div className="cust-col-2 cust-status-col">
                    <span className={`badge ${statusBadge(c.customerStatus)}`}>{c.customerStatus}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Customer Detail Drawer ─── */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={closeDrawer} />
          <div className="cust-detail-drawer animate-slide-in">
            <div className="drawer-header">
              <h3 className="text-headline-sm" style={{ color: 'var(--color-primary)' }}>
                Customer Details
              </h3>
              <button className="drawer-close" onClick={closeDrawer}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="drawer-body">
              {drawerLoading ? (
                <div className="empty-state" style={{ padding: 60 }}><div className="spinner" /></div>
              ) : !detail ? (
                <div className="empty-state" style={{ padding: 60 }}>
                  <span className="material-symbols-outlined">error</span>
                  <p>Failed to load customer details.</p>
                </div>
              ) : (
                <>
                  {/* ── Summary Stats ── */}
                  <div className="cust-detail-stats">
                    <div className="cust-detail-stat-card">
                      <span className="material-symbols-outlined cust-detail-stat-icon" style={{ color: 'var(--color-primary-container)' }}>shopping_bag</span>
                      <div className="cust-detail-stat-value">{detail.customer.totalOrders}</div>
                      <div className="cust-detail-stat-label">Total Orders</div>
                    </div>
                    <div className="cust-detail-stat-card">
                      <span className="material-symbols-outlined cust-detail-stat-icon" style={{ color: 'var(--color-gold)' }}>payments</span>
                      <div className="cust-detail-stat-value">{formatCurrency(detail.customer.totalSpend)}</div>
                      <div className="cust-detail-stat-label">Total Spend</div>
                    </div>
                    <div className="cust-detail-stat-card">
                      <span className="material-symbols-outlined cust-detail-stat-icon" style={{ color: 'var(--color-teal)' }}>receipt_long</span>
                      <div className="cust-detail-stat-value">{formatCurrency(detail.customer.avgOrderValue)}</div>
                      <div className="cust-detail-stat-label">Avg Order Value</div>
                    </div>
                  </div>

                  {/* ── Payment Breakdown Badges ── */}
                  {detail.customer.paymentBreakdown && (
                    <div className="cust-detail-payment-breakdown">
                      {Object.entries(detail.customer.paymentBreakdown)
                        .filter(([, count]) => count > 0)
                        .map(([status, count]) => (
                          <span key={status} className={`badge ${payBadge(status)}`}>
                            {status}: {count}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* ── Customer Info Section ── */}
                  <section className="drawer-section">
                    <h4 className="drawer-section-title">Customer Info</h4>
                    <div className="cust-detail-info-grid">
                      <div className="cust-detail-info-item">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary-container)' }}>person</span>
                        <div>
                          <div className="cust-detail-info-label">Name</div>
                          <div className="cust-detail-info-value">{detail.customer.name}</div>
                        </div>
                      </div>
                      <div className="cust-detail-info-item">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary-container)' }}>call</span>
                        <div>
                          <div className="cust-detail-info-label">Phone</div>
                          <div className="cust-detail-info-value">{displayPhone(detail.customer.phone)}</div>
                        </div>
                      </div>
                      <div className="cust-detail-info-item">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary-container)' }}>location_on</span>
                        <div>
                          <div className="cust-detail-info-label">Address</div>
                          <div className="cust-detail-info-value">{detail.customer.address || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="cust-detail-info-item">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary-container)' }}>share</span>
                        <div>
                          <div className="cust-detail-info-label">Platform</div>
                          <div className="cust-detail-info-value">{detail.customer.platform || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="cust-detail-info-item">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--color-primary-container)' }}>grade</span>
                        <div>
                          <div className="cust-detail-info-label">Status</div>
                          <div><span className={`badge ${statusBadge(detail.customer.customerStatus)}`}>{detail.customer.customerStatus}</span></div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ── Order History Section ── */}
                  <section className="drawer-section">
                    <h4 className="drawer-section-title">Order History ({detail.orders.length})</h4>
                    {detail.orders.length === 0 ? (
                      <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 14, padding: 12 }}>No orders found.</p>
                    ) : (
                      <div className="cust-detail-orders">
                        {detail.orders.map((o) => (
                          <div key={o.id} className="cust-detail-order-card">
                            <div className="cust-detail-order-header">
                              <span className="cust-detail-order-id">#{o.orderId}</span>
                              <span className={`badge ${itemBadge(o.itemStatus)}`}>{o.itemStatus}</span>
                            </div>
                            <div className="cust-detail-order-body">
                              <div className="cust-detail-order-row">
                                <span className="cust-detail-order-label">Saree</span>
                                <span>{o.sareeBrand}{o.materialType ? ` · ${o.materialType}` : ''}{o.sareeColor ? ` · ${o.sareeColor}` : ''}</span>
                              </div>
                              <div className="cust-detail-order-row">
                                <span className="cust-detail-order-label">Qty × Price</span>
                                <span>{o.quantity} × {formatCurrency(o.itemPrice)}</span>
                              </div>
                              <div className="cust-detail-order-row">
                                <span className="cust-detail-order-label">Total</span>
                                <span style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{formatCurrency(o.totalAmount)}</span>
                              </div>
                              <div className="cust-detail-order-row">
                                <span className="cust-detail-order-label">Payment</span>
                                <span className={`badge ${payBadge(o.paymentStatus)}`}>{o.paymentStatus}</span>
                              </div>
                              <div className="cust-detail-order-row">
                                <span className="cust-detail-order-label">Ordered</span>
                                <span>{o.orderPlacedDate || '—'}</span>
                              </div>
                              {o.expectedDeliveryDate && (
                                <div className="cust-detail-order-row">
                                  <span className="cust-detail-order-label">Expected Delivery</span>
                                  <span>{o.expectedDeliveryDate}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
