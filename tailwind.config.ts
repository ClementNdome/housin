import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a4d47',
        'primary-dark': '#0f2f2a',
        'primary-light': '#2a6b63',
        secondary: '#f97316',
        accent: '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        'status-completed': '#10b981',
        'status-ongoing': '#f97316',
        'status-nearing': '#eab308',
        'status-planned': '#6b7280',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
      spacing: {
        'sidebar-width': '300px',
      },
    },
  },
  plugins: [],
}
export default config
