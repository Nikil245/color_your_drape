import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ordersAPI } from '../services/api';
import { useToast } from '../components/Toast';
import OrderForm from './OrderForm';
import OrderHistory from './OrderHistory';
import './Orders.css';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'new';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="orders-page animate-fade-in">
      <div className="orders-header">
        <h1 className="text-display-lg" style={{ color: 'var(--color-on-surface)' }}>Orders</h1>
      </div>
      <div className="orders-tabs">
        <button className={`orders-tab ${activeTab === 'new' ? 'orders-tab-active' : ''}`}
          onClick={() => { setActiveTab('new'); setSearchParams({ tab: 'new' }); }}>
          Add New Order
        </button>
        <button className={`orders-tab ${activeTab === 'history' ? 'orders-tab-active' : ''}`}
          onClick={() => { setActiveTab('history'); setSearchParams({ tab: 'history' }); }}>
          Order History
        </button>
      </div>
      {activeTab === 'new' && <OrderForm />}
      {activeTab === 'history' && <OrderHistory />}
    </div>
  );
}
