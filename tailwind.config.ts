import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050508',
          900: '#0a0a12',
          850: '#0e0e18',
          800: '#12121e',
          700: '#1a1a2a',
          600: '#242438',
        },
        star: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        pulse: {
          400: '#60a5fa',
          500: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Vazirmatn', 'system-ui', 'Segoe UI', 'sans-serif'],
        fa: ['Vazirmatn', 'Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-y': 'floatY 6s ease-in-out infinite',
        shimmer: 'shimmer 2.8s linear infinite',
        'spin-slow': 'spin 9s linear infinite',
      },
      keyframes: {
        floatY: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      boxShadow: {
        glow: '0 0 44px -10px rgba(139, 92, 246, 0.55)',
        'glow-sm': '0 0 22px -6px rgba(139, 92, 246, 0.45)',
        card: '0 10px 40px -14px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
} satisfies Config
