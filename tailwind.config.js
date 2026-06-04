/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Todos los colores son CSS variables inyectadas en runtime por
        // useTheme según la config del tenant. Nunca hardcodear hex.
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        background: 'var(--color-background)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        subtle: 'var(--color-subtle)',
        line: 'var(--color-border)',
        'line-soft': 'var(--color-border-soft)',
        'on-primary': 'var(--color-on-primary)',
        'on-accent': 'var(--color-on-accent)',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
