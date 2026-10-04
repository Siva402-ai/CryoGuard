/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#1A2BC3',
          hover: '#1422A3',
          soft: '#EEF1FF',
        },
        accent: {
          DEFAULT: '#7EF0C9',
          soft: '#E6FBF3',
        },
        teal: '#4AA8B5',
        navy: '#0B1633',
        text: '#1F2A44',
        muted: '#5B6578',
        border: '#E5E9F2',
        bg: '#F6F8FC',
        surface: '#FFFFFF',
        status: {
          success: '#0E9F6E',
          'success-bg': '#E7F8F0',
          warning: '#C77700',
          'warning-bg': '#FFF4DE',
          critical: '#D92D20',
          'critical-bg': '#FDECEA',
          info: '#1A2BC3',
          'info-bg': '#EEF1FF',
          neutral: '#5B6578',
          'neutral-bg': '#EEF1F6',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,22,51,0.04), 0 8px 24px rgba(11,22,51,0.04)',
        topbar: '0 1px 2px rgba(11,22,51,0.04), 0 8px 24px rgba(11,22,51,0.04)',
      },
      borderRadius: {
        '2xl': '16px',
        'xl': '12px',
      },
    },
  },
  plugins: [],
}
