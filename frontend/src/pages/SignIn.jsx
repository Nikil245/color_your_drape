import { useState, useEffect } from 'react';
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

/* ─── KPI stat icons ─── */
const IconOrders = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);

const IconSales = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);

const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/* ─── Feature pill icons ─── */
const IconInventory = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const IconPayment = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const IconReports = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

/* ─── Sample KPI values (clearly sample data) ─── */
const SAMPLE_STATS = [
  { label: 'Total Orders', value: '1.2K+', Icon: IconOrders },
  { label: 'Total Sales', value: '₹4.8L+', Icon: IconSales },
  { label: 'Customer Satisfaction', value: '98%', Icon: IconStar },
];

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

  /* Preload hero image */
  const [heroLoaded, setHeroLoaded] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.src = '/saree-boutique-hero.jpg';
    img.onload = () => setHeroLoaded(true);
    img.onerror = () => setHeroLoaded(true); // still show page
  }, []);

  return (
    <div className="signin-page">
      {/* ════════════ LEFT PANEL — Photographic hero ════════════ */}
      <aside className="signin-left" aria-hidden="true">
        {/* Hero background photograph */}
        <div className={`signin-hero-bg${heroLoaded ? ' signin-hero-bg--loaded' : ''}`}>
          <img
            src="/saree-boutique-hero.jpg"
            alt="Indian woman wearing magenta silk saree in boutique"
            className="signin-hero-img"
            loading="eager"
          />
          {/* Dark burgundy overlay for text readability */}
          <div className="signin-hero-overlay" />
        </div>

        {/* Content on top of hero */}
        <div className="signin-left-content">
          {/* Brand wordmark */}
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
          <div className="signin-hero-copy">
            <h2 className="signin-headline">
              Run your saree business<br />like a <span className="signin-headline-gold">boutique brand.</span>
            </h2>
            <div className="signin-headline-rule" />
            <p className="signin-subtext">
              Manage orders, inventory, payments and customers
              from Instagram and WhatsApp — all in one place.
            </p>
          </div>

          {/* Statistics card */}
          <div className="signin-stats-card">
            <p className="signin-stats-note">Sample preview · not real data</p>
            <div className="signin-stats-grid">
              {SAMPLE_STATS.map(({ label, value, Icon }) => (
                <div className="signin-stat" key={label}>
                  <span className="signin-stat-icon"><Icon /></span>
                  <span className="signin-stat-value">{value}</span>
                  <span className="signin-stat-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feature pills */}
          <div className="signin-pills">
            <span className="signin-pill">
              <IconInventory />
              Live Inventory
            </span>
            <span className="signin-pill">
              <IconPayment />
              Per-item Payments
            </span>
            <span className="signin-pill">
              <IconReports />
              Printable Reports
            </span>
          </div>
        </div>
      </aside>

      {/* ════════════ RIGHT PANEL — Login form ════════════ */}
      <main className="signin-right">
        {/* Subtle decorative pattern */}
        <div className="signin-right-pattern" aria-hidden="true" />

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
