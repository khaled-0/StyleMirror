import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{svelte,ts,js}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { 950: '#0a0810', 900: '#14121b', 800: '#1c1828', 700: '#2a2538' },
        violet: { glow: '#a78bfa' },
      },
      animation: {
        'sheen': 'sheen 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.34,1.4,0.64,1) forwards',
      },
      keyframes: {
        sheen: {
          '0%, 100%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
