import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { authAPI, settingsAPI } from '../services/api';
import './Settings.css';

/* ─── Small reusable inline message ─── */
function InlineMsg({ msg }) {
  if (!msg) return null;
  return (
    <div className={`settings-msg ${msg.type}`}>
      <span className="material-symbols-outlined">
        {msg.type === 'success' ? 'check_circle' : 'error'}
      </span>
      {msg.text}
    </div>
  );
}

/* ─── Password field with show/hide toggle ─── */
function PasswordField({ id, label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="settings-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="settings-password-field">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={onChange}
          placeholder={placeholder || ''}
          autoComplete="off"
        />
        <button
          type="button"
          className="settings-password-toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          <span className="material-symbols-outlined">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, setUser } = useAuth();
  const { settings, setSettings, refetchSettings } = useSettings();

  /* ── Account section ── */
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [nameMsg, setNameMsg] = useState(null);
  const [nameSaving, setNameSaving] = useState(false);

  // Keep local name in sync if user changes elsewhere
  useEffect(() => {
    setNameValue(user?.name || '');
  }, [user?.name]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameMsg({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    setNameSaving(true);
    setNameMsg(null);
    try {
      const res = await authAPI.updateProfile(trimmed);
      setUser(res.data.user);
      setNameMsg({ type: 'success', text: 'Name updated successfully.' });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg
        || err.response?.data?.error
        || 'Failed to update name.';
      setNameMsg({ type: 'error', text: msg });
    } finally {
      setNameSaving(false);
    }
  };

  /* ── Change Password section ── */
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);

    if (pwForm.newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    setPwSaving(true);
    try {
      await authAPI.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwMsg({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg
        || err.response?.data?.error
        || 'Failed to change password.';
      setPwMsg({ type: 'error', text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  /* ── Business Info section ── */
  const [bizForm, setBizForm] = useState({
    businessName: settings.businessName,
    tagline: settings.tagline,
    contactPhone: settings.contactPhone,
  });
  const [bizMsg, setBizMsg] = useState(null);
  const [bizSaving, setBizSaving] = useState(false);

  // Sync if settings load late (e.g. first render before fetch completes)
  useEffect(() => {
    setBizForm({
      businessName: settings.businessName,
      tagline: settings.tagline,
      contactPhone: settings.contactPhone,
    });
  }, [settings.businessName, settings.tagline, settings.contactPhone]);

  const handleBizChange = (field) => (e) =>
    setBizForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSaveBiz = async (e) => {
    e.preventDefault();
    if (!bizForm.businessName.trim()) {
      setBizMsg({ type: 'error', text: 'Business name is required.' });
      return;
    }
    setBizSaving(true);
    setBizMsg(null);
    try {
      const res = await settingsAPI.updateBusiness({
        businessName: bizForm.businessName.trim(),
        tagline: bizForm.tagline.trim(),
        contactPhone: bizForm.contactPhone.trim(),
        lowStockThreshold: settings.lowStockThreshold, // preserve current threshold
      });
      setSettings((prev) => ({ ...prev, ...res.data.settings }));
      setBizMsg({ type: 'success', text: 'Business info saved.' });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg
        || err.response?.data?.error
        || 'Failed to save business info.';
      setBizMsg({ type: 'error', text: msg });
    } finally {
      setBizSaving(false);
    }
  };

  /* ── Inventory Preferences section ── */
  const [thresholdValue, setThresholdValue] = useState(settings.lowStockThreshold);
  const [invMsg, setInvMsg] = useState(null);
  const [invSaving, setInvSaving] = useState(false);

  useEffect(() => {
    setThresholdValue(settings.lowStockThreshold);
  }, [settings.lowStockThreshold]);

  const handleSaveThreshold = async (e) => {
    e.preventDefault();
    const val = Number(thresholdValue);
    if (!Number.isInteger(val) || val < 0) {
      setInvMsg({ type: 'error', text: 'Threshold must be a non-negative whole number.' });
      return;
    }
    setInvSaving(true);
    setInvMsg(null);
    try {
      const res = await settingsAPI.updateBusiness({
        businessName: settings.businessName,
        tagline: settings.tagline,
        contactPhone: settings.contactPhone,
        lowStockThreshold: val,
      });
      setSettings((prev) => ({ ...prev, ...res.data.settings }));
      setInvMsg({ type: 'success', text: 'Inventory preference saved.' });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg
        || err.response?.data?.error
        || 'Failed to save preference.';
      setInvMsg({ type: 'error', text: msg });
    } finally {
      setInvSaving(false);
    }
  };

  return (
    <div className="settings-page">
      {/* ── Page Header ── */}
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Manage your account, business info, and application preferences.</p>
      </div>

      {/* ══════════════════════════════════
          SECTION 1 — Account
          ══════════════════════════════════ */}
      <section className="settings-section" aria-labelledby="account-heading">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">manage_accounts</span>
          </div>
          <div>
            <div className="settings-section-title" id="account-heading">Account</div>
            <div className="settings-section-subtitle">Your admin profile details</div>
          </div>
        </div>

        <div className="settings-section-body">
          {/* Email — read-only */}
          <div className="settings-field-row">
            <div className="settings-field">
              <span className="settings-field-label">Email Address</span>
              <div className="settings-field-value">{user?.email || '—'}</div>
            </div>
          </div>

          <hr className="settings-divider" />

          {/* Name — editable */}
          <form onSubmit={handleUpdateName} noValidate id="form-update-name">
            <div className="settings-field" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="setting-name">Display Name</label>
              <div className="settings-edit-group">
                <input
                  id="setting-name"
                  type="text"
                  className="form-input"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={nameSaving}
                  id="btn-update-name"
                >
                  {nameSaving ? 'Saving…' : 'Update Name'}
                </button>
              </div>
              <InlineMsg msg={nameMsg} />
            </div>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════
          SECTION 2 — Change Password
          ══════════════════════════════════ */}
      <section className="settings-section" aria-labelledby="password-heading">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">lock</span>
          </div>
          <div>
            <div className="settings-section-title" id="password-heading">Change Password</div>
            <div className="settings-section-subtitle">Minimum 8 characters required</div>
          </div>
        </div>

        <div className="settings-section-body">
          <form onSubmit={handleChangePassword} noValidate id="form-change-password">
            <div className="settings-password-grid">
              <PasswordField
                id="setting-current-password"
                label="Current Password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
              <PasswordField
                id="setting-new-password"
                label="New Password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="At least 8 characters"
              />
              <PasswordField
                id="setting-confirm-password"
                label="Confirm New Password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat new password"
              />
            </div>

            <InlineMsg msg={pwMsg} />

            <div className="settings-action-row" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={pwSaving}
                id="btn-change-password"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock_reset</span>
                {pwSaving ? 'Changing…' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════
          SECTION 3 — Business Info
          ══════════════════════════════════ */}
      <section className="settings-section" aria-labelledby="business-heading">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">storefront</span>
          </div>
          <div>
            <div className="settings-section-title" id="business-heading">Business Info</div>
            <div className="settings-section-subtitle">Displayed in the sidebar and app header</div>
          </div>
        </div>

        <div className="settings-section-body">
          <form onSubmit={handleSaveBiz} noValidate id="form-business-info">
            <div className="settings-field-row">
              <div className="settings-field">
                <label className="form-label" htmlFor="setting-biz-name">Business Name</label>
                <input
                  id="setting-biz-name"
                  type="text"
                  className="form-input"
                  value={bizForm.businessName}
                  onChange={handleBizChange('businessName')}
                  placeholder="e.g. Colour Your Drape"
                  maxLength={80}
                />
              </div>

              <div className="settings-field">
                <label className="form-label" htmlFor="setting-tagline">Tagline</label>
                <input
                  id="setting-tagline"
                  type="text"
                  className="form-input"
                  value={bizForm.tagline}
                  onChange={handleBizChange('tagline')}
                  placeholder="e.g. Artisanal Luxury"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="settings-field-row full-width">
              <div className="settings-field">
                <label className="form-label" htmlFor="setting-contact-phone">Contact Phone Number</label>
                <input
                  id="setting-contact-phone"
                  type="tel"
                  className="form-input"
                  value={bizForm.contactPhone}
                  onChange={handleBizChange('contactPhone')}
                  placeholder="e.g. +91 98765 43210"
                  maxLength={20}
                />
              </div>
            </div>

            <InlineMsg msg={bizMsg} />

            <div className="settings-action-row" style={{ marginTop: 20 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={bizSaving}
                id="btn-save-business"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                {bizSaving ? 'Saving…' : 'Save Business Info'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════
          SECTION 4 — Inventory Preferences
          ══════════════════════════════════ */}
      <section className="settings-section" aria-labelledby="inventory-pref-heading">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <span className="material-symbols-outlined">inventory_2</span>
          </div>
          <div>
            <div className="settings-section-title" id="inventory-pref-heading">Inventory Preferences</div>
            <div className="settings-section-subtitle">Controls stock status thresholds across the app</div>
          </div>
        </div>

        <div className="settings-section-body">
          <form onSubmit={handleSaveThreshold} noValidate id="form-inventory-prefs">
            <div className="settings-field-row">
              <div className="settings-field">
                <label className="form-label" htmlFor="setting-low-stock">Low Stock Threshold</label>
                <input
                  id="setting-low-stock"
                  type="number"
                  className="form-input"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  min={0}
                  step={1}
                  placeholder="e.g. 5"
                />
                <p className="threshold-hint">
                  Items with fewer than or equal to this many units remaining are marked "Low Stock".
                  Currently: <strong>{settings.lowStockThreshold} units</strong>.
                </p>
              </div>
            </div>

            <InlineMsg msg={invMsg} />

            <div className="settings-action-row" style={{ marginTop: 12 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={invSaving}
                id="btn-save-inventory-prefs"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                {invSaving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
