import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';

/**
 * Gate del PRIMER paint: la tienda entera aparece de una sola vez.
 *
 * Antes cada bloque se pintaba apenas su propio fetch terminaba (navbar →
 * categorías → banner → productos), y la home "saltaba" mientras cargaba. Ahora
 * el árbol se monta igual (los fetches arrancan en paralelo) pero queda INVISIBLE
 * detrás del skeleton hasta que los datos de arriba del fold están listos; recién
 * ahí se revela todo junto con un fade corto.
 *
 * Cada bloque crítico se anota con `useFirstPaintGate(key, pending)`. El latch es
 * de una sola vía: una vez revelado, no vuelve a taparse (las navegaciones dentro
 * de la SPA no pasan por el gate).
 */

// Sin ningún gate registrado (rutas que no anotan nada, ej: el detalle de
// producto), mostramos igual pasado este tiempo. Cubre también la descarga del
// chunk lazy de la página, que todavía no montó y por eso no registró nada.
const GRACE_MS = 1000;
// Tope duro: en redes lentas nunca dejamos la pantalla tapada más que esto.
const MAX_WAIT_MS = 3500;

interface FirstPaintValue {
  report: (key: string, pending: boolean) => void;
}

const FirstPaintContext = createContext<FirstPaintValue | null>(null);

export function FirstPaintProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  // Estado en refs: el gate se resuelve fuera del ciclo de render y no queremos
  // re-renderear el árbol entero cada vez que un bloque reporta.
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const readyRef = useRef(false);

  const reveal = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
  }, []);

  const settle = useCallback(() => {
    if (readyRef.current) return;
    // Todavía no se registró ningún bloque: esperamos (lo destraba la gracia).
    if (pendingRef.current.size === 0) return;
    for (const pending of pendingRef.current.values()) if (pending) return;
    reveal();
  }, [reveal]);

  const report = useCallback(
    (key: string, pending: boolean) => {
      if (readyRef.current) return;
      pendingRef.current.set(key, pending);
      if (!pending) settle();
    },
    [settle],
  );

  useEffect(() => {
    const grace = setTimeout(() => {
      if (pendingRef.current.size === 0) reveal();
    }, GRACE_MS);
    const cap = setTimeout(reveal, MAX_WAIT_MS);
    return () => {
      clearTimeout(grace);
      clearTimeout(cap);
    };
  }, [reveal]);

  const value = useMemo<FirstPaintValue>(() => ({ report }), [report]);

  return (
    <FirstPaintContext.Provider value={value}>
      {!ready && (
        <div className="fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
          <LoadingScreen />
        </div>
      )}
      {/* El contenido se monta siempre (así los fetches arrancan), pero recién se
          ve cuando el gate abre. `invisible` además lo saca del foco/lectores. */}
      <div
        className={
          ready ? 'opacity-100 transition-opacity duration-300 ease-out' : 'invisible opacity-0'
        }
      >
        {children}
      </div>
    </FirstPaintContext.Provider>
  );
}

/**
 * Anota un bloque como crítico para el primer paint. Mientras `pending` sea true,
 * la tienda sigue tapada por el skeleton. Fuera del provider no hace nada.
 */
export function useFirstPaintGate(key: string, pending: boolean): void {
  const ctx = useContext(FirstPaintContext);
  useEffect(() => {
    ctx?.report(key, pending);
  }, [ctx, key, pending]);
}
