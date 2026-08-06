/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ajo: {
          canvas: '#FBF6EF',
          surface: '#FFFFFF',
          surfaceSunken: '#F3ECE0',
          ink: '#221A14',
          inkSoft: '#71655A',
          inkFaint: '#A89C8E',
          line: '#E8DDCC',
          primary: '#B4502C',
          primarySoft: '#F3DFD2',
          accent: '#C9961E',
          accentSoft: '#F6E9C7',
          success: '#3E7D52',
          successSoft: '#DEEFE2',
          danger: '#B33B3B',
          dangerSoft: '#F6DEDE',
          warning: '#B5791E',
          warningSoft: '#F6E7CD',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'soft': '0 24px 70px rgba(16, 21, 20, 0.14)',
      }
    },
  },
  plugins: [],
}