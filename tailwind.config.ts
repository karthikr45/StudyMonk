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
        // StudyMonk brand — teal primary, amber accent, cream paper.
        brand: {
          DEFAULT: '#1f4e5f',
          dark: '#163b48',
          light: '#eef4f5',
          50: '#eef4f5',
          100: '#d9e7ea',
          200: '#b3ced4',
          300: '#84acb5',
          400: '#52818f',
          500: '#2f6675',
          600: '#1f4e5f',
          700: '#163b48',
          800: '#0f2b34',
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
        'brand-gradient': 'linear-gradient(135deg, #2f6675 0%, #1f4e5f 100%)',
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
