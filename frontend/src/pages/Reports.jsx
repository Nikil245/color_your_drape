import { useEffect, useState } from 'react';
import { reportsAPI } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import './Reports.css';

const periodOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'all_time', label: 'All Time' },
  { value: 'custom', label: 'Custom Date Range' },
];

function formatCurrency(num) {
  if (!num && num !== 0) return '₹0';
  return '₹' + Number(num).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function monthStartIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function periodLabel(period, dateRange) {
  if (period === 'custom') {
    return `${formatDate(dateRange?.startDate)} to ${formatDate(dateRange?.endDate)}`;
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }
  return periodOptions.find((option) => option.value === period)?.label || 'This Month';
}

export default function Reports() {
  const { settings } = useSettings();
  const [report, setReport] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async (params) => {
    setLoading(true);
    setError('');
    try {
      const res = await reportsAPI.summary(params);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport({ period: 'this_month' });
  }, []);

  const handlePeriodChange = (value) => {
    setSelectedPeriod(value);
    if (value !== 'custom') {
      fetchReport({ period: value });
    } else {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    if (selectedPeriod === 'custom') {
      if (!startDate || !endDate) {
        setError('Choose both a start date and an end date.');
        return;
      }
      if (startDate > endDate) {
        setError('Start date cannot be after end date.');
        return;
      }
      fetchReport({ period: 'custom', startDate, endDate });
      return;
    }

    fetchReport({ period: selectedPeriod });
  };

  const handlePrint = () => {
    window.print();
  };

  const summaryCards = [
    { label: 'Total Sales', value: formatCurrency(report?.summary?.totalSales), icon: 'payments' },
    { label: 'Total Profit', value: formatCurrency(report?.summary?.totalProfit), icon: 'account_balance_wallet' },
    { label: 'Total Orders', value: report?.summary?.totalOrders ?? 0, icon: 'shopping_bag' },
    { label: 'Average Order Value', value: formatCurrency(report?.summary?.avgOrderValue), icon: 'receipt_long' },
  ];

  return (
    <div className="reports-page animate-fade-in">
      <div className="reports-header no-print">
        <div>
          <h1 className="text-headline-md">Reports</h1>
          <p className="text-body-md">Generate a printable business summary.</p>
        </div>
      </div>

      <div className="reports-controls no-print">
        <div className="report-control-field">
          <label htmlFor="reports-period" className="report-control-label">
            <span className="material-symbols-outlined">calendar_month</span>
            Period
          </label>
          <select
            id="reports-period"
            className="period-select"
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            disabled={loading}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {selectedPeriod === 'custom' && (
          <div className="custom-date-fields">
            <div className="report-control-field">
              <label htmlFor="reports-start-date" className="report-control-label">Start Date</label>
              <input
                id="reports-start-date"
                className="report-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="report-control-field">
              <label htmlFor="reports-end-date" className="report-control-label">End Date</label>
              <input
                id="reports-end-date"
                className="report-date-input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="reports-actions">
          <button className="btn-secondary" onClick={handleGenerate} disabled={loading}>
            <span className="material-symbols-outlined">summarize</span>
            Generate Report
          </button>
          <button className="btn-primary" onClick={handlePrint} disabled={!report || loading}>
            <span className="material-symbols-outlined">print</span>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Generating report...</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
        </div>
      ) : report ? (
        <article className="report-paper" aria-label="Business report">
          <header className="report-document-header">
            <div className="report-brand-block">
              <img src="/logo.png" alt="Colour Your Drape" className="report-logo" />
              <div>
                <p className="report-kicker">Business Summary Report</p>
                <h2>{settings.businessName}</h2>
                <p>{settings.tagline}</p>
              </div>
            </div>
            <div className="report-meta">
              <div>
                <span>Period</span>
                <strong>{periodLabel(report.selectedPeriod, report.dateRange)}</strong>
              </div>
              <div>
                <span>Generated</span>
                <strong>{new Date(report.generatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}</strong>
              </div>
            </div>
          </header>

          <section className="report-section">
            <div className="report-section-heading">
              <h3>Business Summary</h3>
            </div>
            <div className="report-summary-grid">
              {summaryCards.map((item) => (
                <div className="report-summary-card" key={item.label}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <p>{item.label}</p>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <h3>Top Selling Brands</h3>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Brand Name</th>
                    <th>Quantity Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topSellingBrands.length > 0 ? (
                    report.topSellingBrands.map((brand, index) => (
                      <tr key={brand.brandName}>
                        <td>{index + 1}</td>
                        <td>{brand.brandName}</td>
                        <td>{brand.quantitySold}</td>
                        <td>{formatCurrency(brand.revenue)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4">No brand sales found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <h3>Customer Summary</h3>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Number of Orders</th>
                    <th>Total Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {report.customerSummary.length > 0 ? (
                    report.customerSummary.map((customer) => (
                      <tr key={`${customer.name}-${customer.phone}`}>
                        <td>{customer.name}</td>
                        <td>{customer.totalOrders}</td>
                        <td>{formatCurrency(customer.totalSpent)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3">No customers found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <h3>Payment Status Breakdown</h3>
            </div>
            <div className="report-payment-grid">
              {report.paymentStatusBreakdown.map((payment) => (
                <div className="payment-breakdown-item" key={payment.status}>
                  <span>{payment.status}</span>
                  <strong>{payment.count}</strong>
                  <p>{formatCurrency(payment.amount)}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      ) : null}
    </div>
  );
}
