import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type CurrencyCode = 'USD' | 'BRL' | 'EUR' | 'ARS' | 'COP' | 'CLP' | 'PEN' | 'MXN' | 'VES' | 'GBP';

interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  name: string;
  decimals: number;
}

export const currencies: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', flag: '🇺🇸', name: 'USD', decimals: 2 },
  { code: 'BRL', symbol: 'R$', flag: '🇧🇷', name: 'BRL', decimals: 2 },
  { code: 'EUR', symbol: '€', flag: '🇪🇺', name: 'EUR', decimals: 2 },
  { code: 'ARS', symbol: '$', flag: '🇦🇷', name: 'ARS', decimals: 0 },
  { code: 'COP', symbol: '$', flag: '🇨🇴', name: 'COP', decimals: 0 },
  { code: 'CLP', symbol: '$', flag: '🇨🇱', name: 'CLP', decimals: 0 },
  { code: 'PEN', symbol: 'S/', flag: '🇵🇪', name: 'PEN', decimals: 2 },
  { code: 'MXN', symbol: '$', flag: '🇲🇽', name: 'MXN', decimals: 2 },
  { code: 'VES', symbol: 'Bs', flag: '🇻🇪', name: 'VES', decimals: 2 },
  { code: 'GBP', symbol: '£', flag: '🇬🇧', name: 'GBP', decimals: 2 },
];

const countryToCurrency: Record<string, CurrencyCode> = {
  'BR': 'BRL',
  'PT': 'EUR',
  'US': 'USD',
  'AR': 'ARS',
  'CO': 'COP',
  'CL': 'CLP',
  'PE': 'PEN',
  'MX': 'MXN',
  'VE': 'VES',
  'GB': 'GBP',
  'ES': 'EUR',
  'DE': 'EUR',
  'FR': 'EUR',
  'IT': 'EUR',
  'NL': 'EUR',
  'EC': 'USD',
  'UY': 'USD',
  'PA': 'USD',
  'BO': 'USD',
  'PY': 'USD',
};

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  rates: Record<string, number>;
  ratesLoading: boolean;
  formatPrice: (usdAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}

async function detectCurrencyFromIP(): Promise<CurrencyCode> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to fetch location');
    const data = await response.json();
    const countryCode = data.country_code;
    if (countryCode && countryToCurrency[countryCode]) {
      return countryToCurrency[countryCode];
    }
  } catch (error) {
    console.warn('Could not detect currency from IP:', error);
  }
  return 'USD';
}

async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (!response.ok) throw new Error('Failed to fetch rates');
    const data = await response.json();
    return data.rates as Record<string, number>;
  } catch (error) {
    console.warn('Could not fetch exchange rates, using fallback:', error);
    return {
      USD: 1,
      BRL: 5.0,
      EUR: 0.92,
      ARS: 1000,
      COP: 4200,
      CLP: 950,
      PEN: 3.7,
      MXN: 18,
      VES: 40,
      GBP: 0.79,
    };
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('streammanager-currency');
    if (saved && currencies.some(c => c.code === saved)) return saved as CurrencyCode;
    return 'USD';
  });
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [ratesLoading, setRatesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const r = await fetchExchangeRates();
      if (mounted) {
        setRates(r);
        setRatesLoading(false);
      }
    })();

    const saved = localStorage.getItem('streammanager-currency');
    if (!saved || !currencies.some(c => c.code === saved)) {
      (async () => {
        const detected = await detectCurrencyFromIP();
        if (mounted) {
          setCurrencyState(detected);
          localStorage.setItem('streammanager-currency', detected);
        }
      })();
    }

    const refreshInterval = setInterval(async () => {
      const r = await fetchExchangeRates();
      if (mounted) setRates(r);
    }, 30 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(refreshInterval);
    };
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    localStorage.setItem('streammanager-currency', c);
  }, []);

  const formatPrice = useCallback(
    (usdAmount: number) => {
      const info = currencies.find(c => c.code === currency) || currencies[0];
      const rate = rates[currency] || 1;
      const converted = usdAmount * rate;
      const formatted = converted.toLocaleString('en-US', {
        minimumFractionDigits: info.decimals,
        maximumFractionDigits: info.decimals,
      });
      return `${info.symbol} ${formatted}`;
    },
    [currency, rates]
  );

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    rates,
    ratesLoading,
    formatPrice,
  };

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
