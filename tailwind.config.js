/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Vinesight iOS Match - Monochromatic Green Palette
        primary: {
          50: '#f0f5f2',
          100: '#e1ebe5',
          200: '#c3d6cc',
          300: '#9cc5b1',
          400: '#75b397',
          500: '#408059',
          600: '#346a4a',
          700: '#2d5c3f',
          800: '#264d35',
          900: '#1f412b',
          950: '#0f2116',
        },
        secondary: {
          500: '#598d6b',
        },
        accent: {
          500: '#33734d',
        },
        irrigation: {
          500: '#4d8573',
        },
        spray: {
          500: '#598d6b',
        },
        fertigation: {
          500: '#408059',
        },
        harvest: {
          500: '#669475',
        },
        observation: {
          500: '#738c7a',
        },
        task: {
          500: '#4d8573',
        },
        expense: {
          500: '#598066',
        },
        // iOS System Colors
        surface: {
          50: '#f2f2f7',
          100: '#ffffff',
          200: '#f2f2f7',
          300: '#e5e5ea',
          400: '#d1d1d6',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#2c2c2e',
        },
        warning: '#ff9500',
        error: '#ff3b30',
        success: '#34c759',
        // Water status colors
        water: {
          critical: '#db4437',
          low: '#ea8600',
          medium: '#f9a825',
          good: '#0b8d32',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};

