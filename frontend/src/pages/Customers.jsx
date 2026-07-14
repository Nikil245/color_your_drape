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

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersAPI.list({ search });
      setCustomers(res.data.customers);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

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
          <button className="btn-secondary" onClick={fetchCustomers}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>filter_list</span>
            Filter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : customers.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">group</span>
          <p>No customers yet. They'll appear here once you create orders.</p>
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
            {customers.map((c, i) => (
              <div key={i} className="cust-row">
                <div className="cust-col-3 cust-info">
                  <p className="cust-name">{c.name}</p>
                  <p className="cust-phone">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
                    {c.phone}
                  </p>
                </div>
                <div className="cust-col-3 cust-location">
                  <p>{c.address?.split(',').slice(0, 2).join(', ') || 'N/A'}</p>
                  <p className="cust-city">{c.address?.split(',').slice(-1)[0]?.trim() || ''}</p>
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
