import React, { useState } from 'react';
import { DollarSign, ChevronDown } from 'lucide-react';
import { useCurrency, currencies, CurrencyCode } from './CurrencyProvider';

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);

  const current = currencies.find(c => c.code === currency);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between space-x-1 px-1.5 sm:px-2 lg:px-3 py-1.5 sm:py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors touch-manipulation"
      >
        <div className="flex items-center space-x-2">
          <DollarSign className="h-4 w-4" />
          <span className="text-sm sm:text-base">{current?.flag}</span>
          <span className="text-xs sm:text-sm">{current?.code}</span>
        </div>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-64 overflow-y-auto">
            <div className="py-1">
              {currencies.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setCurrency(c.code as CurrencyCode);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs sm:text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2 transition-colors touch-manipulation ${
                    currency === c.code ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span>{c.code}</span>
                  <span className="text-gray-400 text-xs">{c.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
