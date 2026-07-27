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
import { useLocation } from 'react-router-dom';
import { LoadingScreen } from '@/components/LoadingScreen';

/**
 * Gate de pintado: cada pantalla de la tienda aparece DE UNA SOLA VEZ.
 *
 * Antes cada bloque se pintaba apenas su propio fetch terminaba (navbar →
 * categorías → banner → productos), y la pantalla "saltaba" mientras cargaba.
 * Ahora el árbol se monta igual (los fetches arrancan en paralelo) pero el
 * contenido queda INVISIBLE hasta que los bloques críticos avisan que están
 * listos; recién ahí se revela todo junto.
 *
 * Dos momentos, con tiempos distintos:
 *  - PRIMER PAINT (entrada directa / F5): la tienda entera queda tapada por el
 *    LoadingScreen y se revela con un fade corto.
 *  - NAVEGACIÓN INTERNA: el header/footer no se tocan (sería un parpadeo feo);
 *    sólo se retiene el CONTENIDO de la ruta nueva, vía <RouteGate>. Como los
 *    datos suelen venir de cache, la espera casi siempre es imperceptible.
 *
 * Cada bloque crítico se anota con `useFirstPaintGate(key, pending)`. El gate se
 * re-arma en cada cambio de ruta y se destraba cuando todos los bloques
 * anotados de ESA ruta terminaron (o cuando vencen las redes de seguridad).
 */

// Primer paint. Sin ningún gate registrado (rutas que no anotan nada) mostramos
// igual pasada la gracia; el tope duro es el techo en redes lentas.
const GRACE_MS = 1000;
const MAX_WAIT_MS = 3500;
// Navegación interna: más cortos, porque el usuario ya está en la tienda y
// cualquier espera se siente como un cuelgue.
const NAV_GRACE_MS = 250;
const NAV_MAX_WAIT_MS = 1500;

interface FirstPaintValue {
  /** ¿La ruta actual ya se puede mostrar? */
  ready: boolean;
  report: (key: string, pending: boolean) => void;
  release: (key: string) => void;
}

const FirstPaintContext = createContext<FirstPaintValue | null>(null);

export function FirstPaintProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  // El primer paint es el único que tapa TODO con el LoadingScreen.
  const [firstPaintDone, setFirstPaintDone] = useState(false);
  // Estado en refs: el gate se resuelve fuera del ciclo de render y no queremos
  // re-renderear el árbol entero cada vez que un bloque reporta.
  const pendingRef = useRef<Map<string, boolean>>(new Map());
  const readyRef = useRef(false);
  const firstRef = useRef(true);
  const graceRef = useRef(GRACE_MS);
  const emptyTimerRef = useRef<number | null>(null);

  // Re-armado en el MISMO render en que cambia la ruta, no en un efecto: los
  // efectos de los hijos corren ANTES que los del padre, así que limpiar el mapa
  // en un efecto se comería los reportes de la pantalla nueva.
  const [gatedPath, setGatedPath] = useState(pathname);
  if (pathname !== gatedPath) {
    setGatedPath(pathname);
    pendingRef.current.clear();
    readyRef.current = false;
    setReady(false);
  }

  const reveal = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    firstRef.current = false;
    setReady(true);
    setFirstPaintDone(true);
  }, []);

  // Timer de "mapa vacío": si al vencer nadie registró bloques, la ruta no tiene
  // nada que esperar (o es una ruta sin anotar) y se muestra igual.
  const startEmptyTimer = useCallback(() => {
    if (emptyTimerRef.current) window.clearTimeout(emptyTimerRef.current);
    emptyTimerRef.current = window.setTimeout(() => {
      if (pendingRef.current.size === 0) reveal();
    }, graceRef.current);
  }, [reveal]);

  const settle = useCallback(() => {
    if (readyRef.current) return;
    // Todavía no hay bloques registrados: lo destraba la gracia.
    if (pendingRef.current.size === 0) {
      startEmptyTimer();
      return;
    }
    for (const pending of pendingRef.current.values()) if (pending) return;
    reveal();
  }, [reveal, startEmptyTimer]);

  // Resolvemos en un microtask: así corren TODOS los efectos del commit (el
  // bloque que se desmonta y el que se monta) antes de decidir si abrimos.
  const scheduleSettle = useCallback(() => {
    queueMicrotask(settle);
  }, [settle]);

  const report = useCallback(
    (key: string, pending: boolean) => {
      if (readyRef.current) return;
      pendingRef.current.set(key, pending);
      if (!pending) scheduleSettle();
    },
    [scheduleSettle],
  );

  // Un bloque que se desmonta (cambio de ruta, sección que deja de renderizarse)
  // ya no bloquea el gate.
  const release = useCallback(
    (key: string) => {
      if (readyRef.current) return;
      pendingRef.current.delete(key);
      scheduleSettle();
    },
    [scheduleSettle],
  );

  useEffect(() => {
    const first = firstRef.current;
    graceRef.current = first ? GRACE_MS : NAV_GRACE_MS;
    startEmptyTimer();
    const cap = window.setTimeout(() => {
      // En dev avisamos qué bloque se comió el tope: si una pantalla tarda
      // siempre lo mismo, casi seguro hay un gate que no destraba.
      if (import.meta.env.DEV && !readyRef.current) {
        const stuck = [...pendingRef.current.entries()].filter(([, p]) => p).map(([k]) => k);
        console.warn('[paint-gate] tope alcanzado; bloques pendientes:', stuck);
      }
      reveal();
    }, first ? MAX_WAIT_MS : NAV_MAX_WAIT_MS);
    return () => {
      window.clearTimeout(cap);
      if (emptyTimerRef.current) window.clearTimeout(emptyTimerRef.current);
    };
  }, [gatedPath, reveal, startEmptyTimer]);

  const value = useMemo<FirstPaintValue>(() => ({ ready, report, release }), [ready, report, release]);

  // Sólo el primer paint tapa la tienda entera; después el header/footer quedan
  // siempre visibles y el que retiene es <RouteGate>.
  const coverAll = !firstPaintDone && !ready;

  return (
    <FirstPaintContext.Provider value={value}>
      {coverAll && (
        <div className="fixed inset-0 z-[100] overflow-hidden" aria-hidden="true">
          <LoadingScreen />
        </div>
      )}
      {/* El contenido se monta siempre (así los fetches arrancan), pero recién se
          ve cuando el gate abre. `invisible` además lo saca del foco/lectores. */}
      <div
        className={
          coverAll ? 'invisible opacity-0' : 'opacity-100 transition-opacity duration-300 ease-out'
        }
      >
        {children}
      </div>
    </FirstPaintContext.Provider>
  );
}

/**
 * Retiene el contenido de la ruta mientras el gate está cerrado (el header y el
 * footer siguen visibles). Va adentro del <Layout>, envolviendo al <Routes>.
 *
 * Sin fade: animar la opacidad crea un stacking context temporal y los elementos
 * `fixed` de la página (botón de filtros, barra de pedido) saltarían de lugar
 * durante la transición. Como ya esperamos a que los datos estén, aparecer de
 * una es lo correcto.
 */
export function RouteGate({ children }: { children: ReactNode }) {
  const ctx = useContext(FirstPaintContext);
  const ready = ctx?.ready ?? true;
  return <div className={ready ? undefined : 'invisible'}>{children}</div>;
}

/**
 * Anota un bloque como crítico para el pintado de la ruta actual. Mientras
 * `pending` sea true, la pantalla sigue retenida. Fuera del provider no hace nada.
 */
export function useFirstPaintGate(key: string, pending: boolean): void {
  const ctx = useContext(FirstPaintContext);
  useEffect(() => {
    ctx?.report(key, pending);
  }, [ctx, key, pending]);
  // Efecto aparte: la limpieza corre sólo al desmontar (o si cambia la key), no
  // en cada cambio de `pending`.
  useEffect(() => () => ctx?.release(key), [ctx, key]);
}
