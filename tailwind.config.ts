import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Charcoal / near-black base
        ink: {
          DEFAULT: '#0B0B0D',
          50: '#16161A',
          100: '#1C1C21',
          200: '#26262D',
          300: '#33333B',
        },
        // Champagne gold accent
        gold: {
          DEFAULT: '#C9A227',
          light: '#F0D67B',
          deep: '#A6841C',
          soft: '#E4C766',
        },
        ivory: {
          DEFAULT: '#F5F1E8',
          muted: '#C9C4B6',
          dim: '#8A867B',
        },
        brass: '#6B5D2E',
        // semantic
        positive: '#5BBF8A',
        negative: '#D98A8A',
        warn: '#E0B75B',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Playfair Display', 'serif'],
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold-rim': '0 0 0 1px rgba(201,162,39,0.28), 0 8px 30px -12px rgba(0,0,0,0.7)',
        'card': '0 10px 40px -18px rgba(0,0,0,0.75)',
        'lift': '0 20px 60px -20px rgba(0,0,0,0.85)',
        'glow': '0 0 30px -6px rgba(201,162,39,0.35)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A227 0%, #F0D67B 50%, #C9A227 100%)',
        'gold-sheen': 'linear-gradient(120deg, transparent 20%, rgba(240,214,123,0.35) 50%, transparent 80%)',
        'ink-radial': 'radial-gradient(1200px 600px at 50% -10%, rgba(201,162,39,0.10), transparent 60%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'hero-zoom': {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.08)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'hero-zoom': 'hero-zoom 6s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
