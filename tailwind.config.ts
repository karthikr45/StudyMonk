import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        // StudyMonk studio palette — iris, mint and warm accents.
        brand: {
          DEFAULT: '#5544b5',
          dark: '#41338c',
          light: '#f3f0ff',
          50: '#f3f0ff',
          100: '#e8e1fc',
          200: '#d0c4f5',
          300: '#afa0e9',
          400: '#8e79db',
          500: '#715bcc',
          600: '#5544b5',
          700: '#41338c',
          800: '#302562',
        },
        accent: {
          DEFAULT: '#E8A33D',
          50: '#fdf6ea',
          100: '#f9e7c6',
          500: '#E8A33D',
          600: '#d18a24',
        },
        paper: '#FAF7F2',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 6px 16px -6px rgb(16 24 40 / 0.08)',
        lift: '0 18px 40px -16px rgb(31 78 95 / 0.32)',
        glow: '0 0 0 1px rgb(31 78 95 / 0.08), 0 12px 32px -12px rgb(31 78 95 / 0.28)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #715bcc 0%, #5544b5 100%)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22,1,0.36,1)',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
