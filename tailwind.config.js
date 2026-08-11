// Con extensión a propósito: este config lo importa como ESM
// `scripts/check-dead-opacity.mjs`, y Node no resuelve el subpath sin `.js`
// (ERR_MODULE_NOT_FOUND). PostCSS lo carga por otro camino y no se entera, así
// que sin la extensión el dev server anda igual pero se cae `npm run check` —
// y con él el `prebuild`, o sea el deploy.
import plugin from 'tailwindcss/plugin.js';

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
      // Esquinas: mismo criterio que los colores. La escala entera sale de CSS
      // variables que applyTheme reescribe según lo que eligió el comercio, así
      // que un `rounded-lg` escrito en cualquier componente ya obedece al token
      // sin tocar el componente.
      //
      // `none` y `full` quedan LITERALES a propósito: son intenciones absolutas,
      // no escalones. `rounded-full` dibuja swatches de color, avatares y dots
      // del carrusel — si siguieran al token, elegir "recto" convertiría los
      // círculos de color en cuadrados. Lo que sí es una pastilla decorativa
      // (chips, badges) usa `rounded-pill`, que abajo sí es variable.
      borderRadius: {
        none: '0px',
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: '9999px',
        // Pastilla "semántica": redonda por default, pero se endereza cuando el
        // comercio elige esquinas rectas. Para chips/badges, NO para círculos.
        pill: 'var(--radius-pill)',
        // Botones: token propio, para permitir cards rectas + botón cápsula.
        button: 'var(--radius-button)',
      },
    },
  },
  plugins: [
    // Variantes por tipo de puntero. Tailwind 3 no las trae (llegan en v4); los
    // nombres son los mismos que usa v4, así que el día que se migre esto se
    // borra y las clases quedan igual.
    //
    // Para qué: los controles táctiles (chips de talle y color) necesitan 44px
    // de alto con el dedo, pero con mouse esos mismos 44px se ven macizos. La
    // medida base es la táctil y `pointer-fine:` la baja — así, si el navegador
    // no soporta la media query, queda el tamaño accesible, no el chico.
    plugin(({ addVariant }) => {
      addVariant('pointer-fine', '@media (pointer: fine)');
      addVariant('pointer-coarse', '@media (pointer: coarse)');
    }),
  ],
};
