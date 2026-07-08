import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Envuelve una sección y la revela con un fade + leve slide-up la primera vez
 * que entra en el viewport (a medida que el cliente baja). Anima una sola vez,
 * respeta "prefers-reduced-motion" y usa sólo opacity/transform (no produce
 * layout shift). El wrapper es un div de ancho completo y sin padding, así que
 * no afecta el layout interno de cada sección.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    // Umbral por PÍXELES, no por porcentaje del elemento: con threshold 0.12 una
    // sección muy alta (ej: una grilla de 12 productos de ~4000px) no se revelaba
    // hasta scrollear ~460px dentro de ella, dejando una pantalla entera en blanco.
    // Con threshold 0 + rootMargin inferior fijo, la sección aparece apenas su
    // borde superior entra ~80px en el viewport, sin importar su alto.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -80px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
