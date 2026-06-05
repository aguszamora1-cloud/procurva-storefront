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
        // Texto seguro sobre el fondo (--color-background) para componentes con
        // fondo propio: cards, navbar. Nunca desaparece aunque el texto global
        // no contraste con el fondo.
        'on-surface': 'var(--color-on-surface)',
        'on-surface-muted': 'var(--color-on-surface-muted)',
        'on-surface-subtle': 'var(--color-on-surface-subtle)',
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
