import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  ArcElement, LineElement, PointElement, Tooltip, Legend,
  LineController, BarController, DoughnutController,
} from 'chart.js';
import { dashboardAPI } from '../services/api';
import './Dashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, LineController, BarController, DoughnutController);

const kpiConfig = [
  { key: 'totalSales', label: 'Total Sales', icon: 'payments', prefix: '₹', borderColor: 'var(--color-primary-container)' },
  { key: 'totalProfit', label: 'Total Profit', icon: 'account_balance_wallet', prefix: '₹', borderColor: 'var(--color-secondary-container)' },
  { key: 'totalOrders', label: 'Total Orders', icon: 'shopping_bag', prefix: '', borderColor: 'var(--color-tertiary-container)' },
  { key: 'avgOrderValue', label: 'Avg Order Value', icon: 'receipt_long', prefix: '₹', borderColor: 'var(--color-outline)' },
  { key: 'pendingDeliveries', label: 'Pending Deliveries', icon: 'local_shipping', prefix: '', borderColor: 'var(--color-error)' },
  { key: 'lowStockItems', label: 'Low Stock Items', icon: 'inventory_2', prefix: '', borderColor: 'var(--color-gold)' },
];

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

const statusBadgeClass = (status) => {
  const map = { Delivered: 'badge-delivered', Shipped: 'badge-shipped', Confirmed: 'badge-confirmed', Packed: 'badge-packed', Returned: 'badge-returned' };
  return map[status] || 'badge-pending';
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.summary()
      .then((res) => setData(res.data))
      .catch((err) => console.error('Dashboard fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" />
        <p style={{ marginTop: 16 }}>Loading dashboard...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <span className="material-symbols-outlined">error</span>
        <p>Failed to load dashboard data.</p>
      </div>
    );
  }

  const { kpis, charts, recentOrders } = data;

  // Sales & Profit chart data
  const salesTrendData = charts.salesTrend || [];
  const salesChartData = {
    labels: salesTrendData.map((d) => d.period),
    datasets: [
      {
        label: 'Profit (₹)',
        data: salesTrendData.map((d) => d.profit),
        type: 'line',
        borderColor: '#C9A227',
        backgroundColor: '#C9A227',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Sales (₹)',
        data: salesTrendData.map((d) => d.sales),
        backgroundColor: '#B21755',
        borderRadius: 4,
      },
    ],
  };

  const salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', align: 'end' } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e0bec4', tickLength: 0 }, border: { dash: [4, 4] } },
      x: { grid: { display: false } },
    },
  };

  // Platform donut
  const platformData = {
    labels: charts.ordersByPlatform?.labels || [],
    datasets: [{
      data: charts.ordersByPlatform?.data || [],
      backgroundColor: ['#B21755', '#2E8B7A', '#C9A227', '#6B3FA0', '#D9782D'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const platformOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: { legend: { display: false } },
  };

  // Top Brands bar
  const brandsData = {
    labels: charts.topBrands?.labels || [],
    datasets: [{
      data: charts.topBrands?.data || [],
      backgroundColor: ['#D9782D', '#2E8B7A', '#6B3FA0', '#B21755', '#C9A227', '#004e42'],
      borderRadius: 4,
      barPercentage: 0.6,
    }],
  };

  const brandsOptions = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { grid: { display: false }, border: { display: false } },
    },
  };

  return (
    <div className="dashboard animate-fade-in">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="text-headline-md" style={{ color: 'var(--color-primary)', marginBottom: 4 }}>
            Dashboard Overview
          </h1>
          <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
            Welcome back, here is your artisanal boutique's performance.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiConfig.map((kpi) => (
          <div key={kpi.key} className="kpi-card glass-card" style={{ borderTopColor: kpi.borderColor }}>
            <div className="kpi-card-top">
              <p className="text-label-md" style={{ color: 'var(--color-on-surface-variant)' }}>{kpi.label}</p>
              <div className="kpi-icon-wrap">
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: kpi.borderColor }}>
                  {kpi.icon}
                </span>
              </div>
            </div>
            <h2 className="text-headline-sm" style={{ color: 'var(--color-on-background)' }}>
              {kpi.prefix ? formatCurrency(kpis[kpi.key]) : kpis[kpi.key]}
            </h2>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Sales & Profit Chart */}
        <div className="glass-card chart-main">
          <div className="chart-header">
            <h3 className="text-headline-sm" style={{ color: 'var(--color-on-background)' }}>
              Sales &amp; Profit Trend
            </h3>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 256 }}>
            {salesTrendData.length > 0 ? (
              <Bar data={salesChartData} options={salesChartOptions} />
            ) : (
              <div className="empty-state" style={{ padding: 40 }}>
                <span className="material-symbols-outlined">bar_chart</span>
                <p>Add orders to see trends</p>
              </div>
            )}
          </div>
        </div>

        {/* Side Charts */}
        <div className="charts-side">
          {/* Platform Donut */}
          <div className="glass-card chart-side-item">
            <h3 className="text-headline-sm" style={{ color: 'var(--color-on-background)', marginBottom: 16 }}>
              Orders by Platform
            </h3>
            <div className="platform-donut-wrapper">
              <div className="chart-canvas-wrap" style={{ height: 160, position: 'relative' }}>
                {charts.ordersByPlatform?.labels?.length > 0 ? (
                  <>
                    <Doughnut data={platformData} options={platformOptions} />
                    <div className="donut-center-label">
                      <div style={{ textAlign: 'center' }}>
                        <div className="text-headline-sm" style={{ lineHeight: 1 }}>{kpis.totalOrders}</div>
                        <div className="text-label-md" style={{ color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                          {kpis.totalOrders === 1 ? 'Order' : 'Orders'}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state" style={{ padding: 20 }}>
                    <p>No data yet</p>
                  </div>
                )}
              </div>
              {charts.ordersByPlatform?.labels?.length > 0 && (
                <div className="custom-legend">
                  {charts.ordersByPlatform.labels.map((label, index) => (
                    <div key={label} className="legend-item">
                      <span
                        className="legend-color-box"
                        style={{ backgroundColor: platformData.datasets[0].backgroundColor[index] }}
                      ></span>
                      <span className="text-label-md">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Brands */}
          <div className="glass-card chart-side-item">
            <h3 className="text-headline-sm" style={{ color: 'var(--color-on-background)', marginBottom: 16 }}>
              Top Selling Brands
            </h3>
            <div className="chart-canvas-wrap" style={{ height: 160 }}>
              {charts.topBrands?.labels?.length > 0 ? (
                <Bar data={brandsData} options={brandsOptions} />
              ) : (
                <div className="empty-state" style={{ padding: 20 }}>
                  <p>No data yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass-card recent-orders">
        <div className="recent-orders-header">
          <h3 className="text-headline-sm" style={{ color: 'var(--color-on-background)' }}>Recent Orders</h3>
          <Link to="/orders?tab=history" className="view-all-link">
            View All
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </Link>
        </div>

        {recentOrders && recentOrders.length > 0 ? (
          <div className="recent-orders-table">
            <div className="rot-header">
              <div>Order ID</div>
              <div>Customer</div>
              <div>Items</div>
              <div>Amount</div>
              <div>Status</div>
            </div>
            {recentOrders.map((order) => (
              <div key={order.id} className="rot-row">
                <div className="rot-cell" data-label="Order ID">
                  <span className="text-label-md">#{order.orderId}</span>
                </div>
                <div className="rot-cell" data-label="Customer">
                  <span>{order.customerName}</span>
                </div>
                <div className="rot-cell" data-label="Items">
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>
                    {order.quantity}x {order.sareeBrand}
                  </span>
                </div>
                <div className="rot-cell" data-label="Amount">
                  <span className="text-label-md">{formatCurrency(order.totalAmount)}</span>
                </div>
                <div className="rot-cell" data-label="Status">
                  <span className={`badge ${statusBadgeClass(order.itemStatus)}`}>
                    {order.itemStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <span className="material-symbols-outlined">receipt_long</span>
            <p>No orders yet. Create your first order!</p>
          </div>
        )}
      </div>
    </div>
  );
}
