import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Translation, getTranslation } from '../lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Map country codes to languages
function getLanguageFromCountry(countryCode: string): Language {
  const countryToLanguage: Record<string, Language> = {
    // Portuguese speaking countries
    'BR': 'pt',
    'PT': 'pt',
    'AO': 'pt',
    'MZ': 'pt',
    'CV': 'pt',
    // Spanish speaking countries
    'ES': 'es',
    'MX': 'es',
    'AR': 'es',
    'CO': 'es',
    'CL': 'es',
    'PE': 'es',
    'VE': 'es',
    'EC': 'es',
    'GT': 'es',
    'CU': 'es',
    'BO': 'es',
    'DO': 'es',
    'HN': 'es',
    'PY': 'es',
    'SV': 'es',
    'NI': 'es',
    'CR': 'es',
    'PA': 'es',
    'UY': 'es',
    'PR': 'es',
    'GQ': 'es',
  };

  return countryToLanguage[countryCode] || 'en';
}

async function detectLanguageFromIP(): Promise<Language> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }

    const data = await response.json();
    const countryCode = data.country_code;

    if (countryCode) {
      return getLanguageFromCountry(countryCode);
    }
  } catch (error) {
    console.warn('Could not detect language from IP:', error);
  }

  // Fallback: try browser language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'pt') return 'pt';
  if (browserLang === 'es') return 'es';

  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('streammanager-language');
    return (saved as Language) || 'en'; // Default to English initially
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initLanguage() {
      // Check if user already has a saved preference
      const saved = localStorage.getItem('streammanager-language');

      if (saved && ['pt', 'en', 'es'].includes(saved)) {
        setLanguageState(saved as Language);
        setInitialized(true);
        return;
      }

      // Detect language from IP
      const detectedLanguage = await detectLanguageFromIP();
      setLanguageState(detectedLanguage);
      localStorage.setItem('streammanager-language', detectedLanguage);
      setInitialized(true);
    }

    initLanguage();
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem('streammanager-language', newLanguage);
  };

  const t = getTranslation(language);

  const value = {
    language,
    setLanguage,
    t,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}