/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          800: '#1a1a1a',
          900: '#0a0a0a',
        },
      },
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
      },
      keyframes: {
        snowfall: {
          'from': {
            transform: 'translateY(-10vh) translateX(0)',
            opacity: '1',
          },
          'to': {
            transform: 'translateY(100vh) translateX(100px)',
            opacity: '0.3',
          },
        },
        snowsway: {
          '0%, 100%': {
            transform: 'translateX(0)',
          },
          '50%': {
            transform: 'translateX(30px)',
          },
        },
        snowrotate: {
          'from': {
            transform: 'rotateZ(0deg)',
          },
          'to': {
            transform: 'rotateZ(360deg)',
          },
        },
      },
      animation: {
        snowfall: 'snowfall 15s linear infinite',
        snowsway: 'snowsway 3s ease-in-out infinite',
        snowrotate: 'snowrotate 3s linear infinite',
      },
    },
  },
  plugins: [],
};
