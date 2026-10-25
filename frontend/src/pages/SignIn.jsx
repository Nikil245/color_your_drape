import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SignIn.css';

/* ─── Inline SVG icons (no external dependency) ─── */
const IconMail = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconEye = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconError = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/* ─── Sample KPI values (clearly sample data) ─── */
const SAMPLE_KPIS = [
  { label: 'Total Orders', target: 142, suffix: '' },
  { label: 'Sales (₹)', target: 84600, suffix: '' },
  { label: 'Pending', target: 12, suffix: '' },
];

/* ─── Count-up hook ─── */
function useCountUp(target, duration = 1600, delay = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let startTime = null;
    let frame;
    const timeout = setTimeout(() => {
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay]);
  return value;
}

/* ─── Format big numbers nicely ─── */
function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return n.toString();
}

/* ─── KPI tile component ─── */
function KpiTile({ label, target, delay }) {
  const val = useCountUp(target, 1500, delay);
  return (
    <div className="preview-kpi">
      <span className="preview-kpi-value">{label === 'Sales (₹)' ? '₹' : ''}{fmt(val)}</span>
      <span className="preview-kpi-label">{label}</span>
    </div>
  );
}

/* ─── Trend line SVG ─── */
function TrendLine() {
  // Simple upward-trending polyline as a path
  const points = "0,34 40,28 80,32 120,20 160,24 200,12 240,16 280,6";
  return (
    <div className="preview-chart">
      <svg viewBox="0 0 280 40" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#C9A227" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon
          className="preview-trend-area"
          points={`0,40 ${points} 280,40`}
        />
        {/* Animated line */}
        <polyline
          className="preview-trend-line"
          points={points}
        />
      </svg>
    </div>
  );
}

/* ─── Paisley / silk-wave SVG pattern ─── */
function PaisleyPattern() {
  return (
    <svg className="signin-pattern" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="paisley" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          {/* Simple repeating arc-wave motif */}
          <path
            d="M0 40 Q20 10 40 40 Q60 70 80 40"
            fill="none"
            stroke="#C9A227"
            strokeWidth="1.2"
          />
          <path
            d="M0 0 Q20 30 40 0 Q60 -30 80 0"
            fill="none"
            stroke="#C9A227"
            strokeWidth="0.7"
          />
          <path
            d="M0 80 Q20 50 40 80 Q60 110 80 80"
            fill="none"
            stroke="#C9A227"
            strokeWidth="0.7"
          />
          {/* Tiny teardrop */}
          <ellipse cx="40" cy="40" rx="4" ry="7" fill="none" stroke="#C9A227" strokeWidth="0.8"
            transform="rotate(30, 40, 40)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#paisley)"/>
    </svg>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */
export default function SignIn() {
  // ── All existing state & handlers — untouched ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await demoLogin();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Demo login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // ── End of existing handlers ──

  return (
    <div className="signin-page">
      {/* ════════════ LEFT PANEL ════════════ */}
      <aside className="signin-left" aria-hidden="true">
        {/* Gold silk-wave pattern */}
        <PaisleyPattern />

        {/* Floating gradient orbs */}
        <div className="signin-orb signin-orb-1" />
        <div className="signin-orb signin-orb-2" />

        {/* Inner content */}
        <div className="signin-left-content">
          {/* Wordmark */}
          <div className="signin-wordmark">
            <img
              src="/logo.png"
              alt="Colour Your Drape logo"
              className="signin-wordmark-logo"
            />
            <div className="signin-wordmark-text">
              <span className="signin-wordmark-name">Colour Your Drape</span>
              <span className="signin-wordmark-tagline">Artisanal Luxury</span>
            </div>
          </div>

          {/* Hero copy */}
          <div className="signin-hero">
            <h2 className="signin-headline">
              Run your saree business<br />
              like a boutique brand.
            </h2>
            <p className="signin-subtext">
              Orders, inventory, payments and customers from Instagram and WhatsApp — all in one place.
            </p>

            {/* Product preview card */}
            <div className="signin-preview-wrap">
              <div className="signin-preview-card" role="presentation">
                <p className="preview-label">Sample preview · not real data</p>

                {/* KPI tiles */}
                <div className="preview-kpis">
                  {SAMPLE_KPIS.map((kpi, i) => (
                    <KpiTile key={kpi.label} label={kpi.label} target={kpi.target} delay={900 + i * 120} />
                  ))}
                </div>

                {/* Trend line */}
                <TrendLine />

                {/* Low-stock chip */}
                <div className="preview-chip">
                  <span className="preview-chip-dot" />
                  3 items low stock
                </div>
              </div>
            </div>

            {/* Feature pills */}
            <div className="signin-pills">
              <span className="signin-pill">
                {/* Inventory icon */}
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Live inventory
              </span>
              <span className="signin-pill">
                {/* Payment icon */}
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                  <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Per-item payments
              </span>
              <span className="signin-pill">
                {/* Reports icon */}
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Printable reports
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ════════════ RIGHT PANEL ════════════ */}
      <main className="signin-right">
        <div className="signin-form-shell">
          {/* Logo */}
          <div className="signin-right-logo-wrap">
            <img
              src="/logo.png"
              alt="Colour Your Drape"
              className="signin-right-logo"
            />
          </div>

          {/* Heading */}
          <h1 className="signin-right-heading">Welcome Back</h1>
          <p className="signin-right-subtext">
            Sign in to access your artisanal collection.
          </p>

          {/* Inline error */}
          {error && (
            <div className="signin-error-new" role="alert" aria-live="assertive">
              <IconError />
              {error}
            </div>
          )}

          {/* Form — all handlers untouched */}
          <form onSubmit={handleSubmit} className="signin-form-new" noValidate>
            {/* Email */}
            <div className="signin-field-group">
              <label className="signin-field-label" htmlFor="signin-email">
                Email Address
              </label>
              <div className="signin-field-wrap">
                <span className="signin-field-icon">
                  <IconMail />
                </span>
                <input
                  id="signin-email"
                  type="email"
                  className="signin-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="signin-field-group">
              <label className="signin-field-label" htmlFor="signin-password">
                Password
              </label>
              <div className="signin-field-wrap">
                <span className="signin-field-icon">
                  <IconLock />
                </span>
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="signin-input signin-input-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="signin-pw-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Sign In */}
            <button
              type="submit"
              id="signin-submit-btn"
              className="signin-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="signin-spinner" role="status" aria-label="Signing in…" />
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="signin-btn-arrow">
                    <IconArrow />
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="signin-divider" aria-hidden="true">
            <span className="signin-divider-line" />
            <span className="signin-divider-text">or</span>
            <span className="signin-divider-line" />
          </div>

          {/* Try Demo */}
          <button
            type="button"
            id="signin-demo-btn"
            className="signin-btn-demo"
            onClick={handleDemoLogin}
            disabled={loading}
          >
            {loading ? 'Starting demo…' : 'Try Demo'}
          </button>
          <p className="signin-demo-hint">Explore with isolated sample data.</p>

          {/* Footer */}
          <div className="signin-trust-new">
            <IconShield />
            <span>Secure Artisan Portal</span>
          </div>
        </div>
      </main>
    </div>
  );
}
