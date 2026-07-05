/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kiyo brand palette: warm charcoal + ember accent + cream neutrals
        ink: {
          50: '#f6f6f4',
          100: '#e9e8e3',
          200: '#d3d1c8',
          300: '#b0ad9f',
          400: '#87836f',
          500: '#6b6856',
          600: '#545244',
          700: '#44423a',
          800: '#2c2b26',
          900: '#1a1a17',
          950: '#0f0f0d',
        },
        ember: {
          50: '#fff5ed',
          100: '#ffe8d4',
          200: '#ffcca8',
          300: '#ffa770',
          400: '#ff7737',
          500: '#fb4f0a',
          600: '#ec3804',
          700: '#c42905',
          800: '#9c2409',
          900: '#7e210d',
          950: '#440d03',
        },
        sage: {
          50: '#f3f7f4',
          100: '#e2ebe4',
          200: '#c6d7cb',
          300: '#9bbbA5',
          400: '#6f9779',
          500: '#4f7a5b',
          600: '#3c6146',
          700: '#314e39',
          800: '#293f2f',
          900: '#233429',
        },
        warning: {
          500: '#eab308',
          600: '#ca8a04',
        },
        error: {
          500: '#dc2626',
          600: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Cabinet Grotesk', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(15,15,13,0.04), 0 4px 12px rgba(15,15,13,0.06)',
        'card-lg': '0 2px 4px rgba(15,15,13,0.05), 0 12px 32px rgba(15,15,13,0.10)',
        'glow': '0 0 0 4px rgba(251,79,10,0.12)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.6 },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        'fade-in': 'fade-in 0.25s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
