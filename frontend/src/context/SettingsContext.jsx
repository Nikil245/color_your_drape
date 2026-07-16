import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';

const SettingsContext = createContext(null);

const DEFAULTS = {
  businessName: 'Colour Your Drape',
  tagline: 'Artisanal Luxury',
  contactPhone: '',
  lowStockThreshold: 5,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await settingsAPI.getBusiness();
      setSettings({ ...DEFAULTS, ...res.data.settings });
    } catch {
      // If fetch fails (e.g. not authenticated yet), keep defaults silently
      setSettings(DEFAULTS);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings, settingsLoading, refetchSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
