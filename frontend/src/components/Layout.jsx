import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import './Layout.css';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { settings } = useSettings();

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-area">
        {/* Mobile Top Bar */}
        <header className="mobile-topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="topbar-brand">{settings.businessName}</h1>
          <div className="topbar-actions">
            <div className="topbar-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav">
        <a href="/dashboard" className="bottom-nav-item">
          <span className="material-symbols-outlined">dashboard</span>
          <span>Dashboard</span>
        </a>
        <a href="/orders" className="bottom-nav-item">
          <span className="material-symbols-outlined">shopping_bag</span>
          <span>Orders</span>
        </a>
        <a href="/customers" className="bottom-nav-item">
          <span className="material-symbols-outlined">group</span>
          <span>Customers</span>
        </a>
      </nav>
    </div>
  );
}
