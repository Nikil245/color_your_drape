import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

export default function Sidebar({ isOpen, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { to: '/orders', icon: 'shopping_bag', label: 'Orders' },
    { to: '/customers', icon: 'group', label: 'Customers' },
    { to: '/inventory', icon: 'inventory_2', label: 'Inventory' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <nav className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <img src="/logo.png" alt="Colour Your Drape" className="sidebar-logo" />
          <div>
            <h1 className="sidebar-title">Colour Your Drape</h1>
            <p className="sidebar-subtitle">Artisanal Luxury</p>
          </div>
        </div>

        {/* New Order Button */}
        <div className="sidebar-action">
          <NavLink to="/orders?tab=new" className="btn-primary" style={{ width: '100%' }} onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            New Order
          </NavLink>
        </div>

        {/* Navigation Links */}
        <div className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              onClick={onClose}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </>
  );
}
