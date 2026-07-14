import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './SignIn.css';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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

  return (
    <div className="signin-container">
      <main className="signin-card-wrapper">
        <div className="signin-card">
          {/* Top gradient accent */}
          <div className="signin-accent" />

          {/* Logo */}
          <div className="signin-logo-wrap">
            <img src="/logo.png" alt="Colour Your Drape" className="signin-logo" />
          </div>

          {/* Welcome Text */}
          <div className="signin-header">
            <h1 className="text-headline-md" style={{ color: 'var(--color-on-background)', marginBottom: 8 }}>
              Welcome Back
            </h1>
            <p className="text-body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
              Sign in to access your artisanal collection.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="signin-error animate-fade-in">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="signin-form">
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="signin-email">Email Address</label>
              <div className="input-with-icon">
                <span className="material-symbols-outlined input-icon">mail</span>
                <input
                  id="signin-email"
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <div className="label-row">
                <label className="form-label" htmlFor="signin-password" style={{ marginBottom: 0 }}>Password</label>
              </div>
              <div className="input-with-icon">
                <span className="material-symbols-outlined input-icon">lock</span>
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: 40, paddingRight: 40 }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {showPassword ? 'visibility' : 'visibility_off'}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit */}
            <div style={{ paddingTop: 16 }}>
              <button type="submit" className="btn-primary signin-submit" disabled={loading}>
                {loading ? (
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Trust Indicator */}
        <div className="signin-trust">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
          <span>Secure Artisan Portal</span>
        </div>
      </main>
    </div>
  );
}
