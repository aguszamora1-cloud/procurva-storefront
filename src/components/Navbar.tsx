import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { useStore, useStoreStatus } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';

const drawerLink = ({ isActive }: { isActive: boolean }) =>
  `block py-3 text-[15px] tracking-[1px] font-semibold uppercase transition-colors ${
    isActive ? 'text-accent' : 'text-on-surface hover:text-accent'
  }`;

interface CategoryOrderRow {
  category_name: string;
  visible: boolean | null;
  image_url: string | null;
}

export function Navbar() {
  const config = useStore();
  const { storeType } = useStoreStatus();
  const { itemCount, open } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // La sección Outfits vive en el home (no tiene página). Mostramos su link en el
  // menú sólo si está habilitada para esta tienda y hay al menos un outfit activo.
  const [hasOutfits, setHasOutfits] = useState(false);
  const showOutfitsLink =
    storeType !== 'wholesale' && config.isPro && config.sections.outfits && hasOutfits;

  // Links principales del menú. (Outfits se muestra como sección del home, no
  // tiene página propia, así que no se agrega para evitar un 404.)
  const navItems = [
    { label: 'INICIO', to: '/', end: true },
    { label: 'PRODUCTOS', to: '/productos', end: false },
  ];

  // Subcategorías del menú. Misma lógica que la página /categorias (useCategories):
  // las categorías viven en products.categories; catalog_category_order solo aporta
  // orden/visibilidad. Hacemos UNIÓN para no depender de que esa tabla esté
  // sincronizada: filas ordenadas/visibles con productos (o imagen propia) +
  // categorías reales de productos que no estén en la tabla. Sin esto, una fila
  // huérfana "Otros" (0 productos) sería lo único que se mostraría en el menú.
  useEffect(() => {
    const cid = config.companyId;
    if (!cid) return;
    let cancelled = false;
    (async () => {
      // En mayorista los productos se filtran por wholesale_price>0 (igual que useProducts).
      const priceCol = storeType === 'wholesale' ? 'wholesale_price' : 'retail_price';
      const [orderRes, prodRes] = await Promise.all([
        supabase
          .from('catalog_category_order')
          .select('category_name, sort_order, visible, image_url')
          .eq('company_id', cid)
          .order('sort_order', { ascending: true }),
        supabase
          .from('products')
          .select('categories')
          .eq('company_id', cid)
          .eq('catalog_visible', true)
          .gt(priceCol, 0),
      ]);
      if (cancelled) return;

      // Conteo por categoría a partir de los productos visibles.
      const counts = new Map<string, number>();
      for (const p of (prodRes.data as { categories: string[] | null }[] | null) ?? []) {
        for (const c of Array.isArray(p.categories) ? p.categories : []) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
      }

      const rows = (orderRes.data as CategoryOrderRow[] | null) ?? [];
      const known = new Set(rows.map((r) => r.category_name));
      // Ordenadas: visibles y con productos (o imagen propia → vacía intencional).
      const ordered = rows
        .filter((r) => r.visible !== false)
        .filter((r) => (counts.get(r.category_name) ?? 0) > 0 || r.image_url)
        .map((r) => r.category_name);
      // Reales no listadas en la tabla, alfabético.
      const extra = Array.from(counts.entries())
        .filter(([name, count]) => count > 0 && !known.has(name))
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b, 'es'));

      setCategories([...ordered, ...extra]);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId, storeType]);

  // ¿La tienda tiene outfits activos? Query liviana (solo count) gateada por los
  // mismos flags que el home usa para renderizar la sección.
  useEffect(() => {
    const cid = config.companyId;
    if (!cid || storeType === 'wholesale' || !config.isPro || !config.sections.outfits) {
      setHasOutfits(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from('catalog_outfits')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', cid)
        .eq('active', true);
      if (!cancelled) setHasOutfits((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [config.companyId, config.isPro, config.sections.outfits, storeType]);

  // Cerrar el menú y la búsqueda al cambiar de ruta (anima la salida porque queda montado).
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Al abrir la búsqueda, enfocar el input; Escape la cierra.
  useEffect(() => {
    if (!searchOpen) return;
    searchInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  // Enviar la búsqueda: navega al listado con ?q= y cierra la barra.
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/productos?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  };

  // Ir a la sección Outfits del home (sin página propia): scrollea al ancla,
  // reintentando si venimos de otra ruta hasta que la sección monte (datos async).
  const goToOutfits = () => {
    setMenuOpen(false);
    const scroll = () => {
      const el = document.getElementById('outfits');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
      return false;
    };
    if (location.pathname === '/') {
      scroll();
      return;
    }
    navigate('/');
    let tries = 0;
    const iv = window.setInterval(() => {
      if (scroll() || ++tries > 20) window.clearInterval(iv);
    }, 150);
  };

  // Mientras el menú está abierto: bloquear scroll del body y cerrar con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Sombra del navbar sólo cuando el usuario ya scrolleó (en el top, sin sombra).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`border-b border-line bg-background transition-shadow duration-200 ${
        scrolled ? 'shadow-md' : ''
      }`}
    >
      <div className="mx-auto grid max-w-none grid-cols-3 items-center gap-2 px-4 py-3 md:px-6">
        {/* Izquierda: hamburguesa + búsqueda (desktop + mobile) */}
        <div className="flex items-center justify-start gap-1">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            className="flex h-9 w-9 items-center justify-center text-on-surface hover:text-accent"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Buscar productos"
            aria-expanded={searchOpen}
            className="flex h-9 w-9 items-center justify-center text-on-surface hover:text-accent"
          >
            <Search className="h-[21px] w-[21px]" strokeWidth={2} />
          </button>
        </div>

        {/* Centro: logo */}
        <Link to="/" className="flex min-w-0 items-center justify-center" aria-label={config.name}>
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={config.name}
              style={{ height: config.logoHeight }}
              className="w-auto max-w-full object-contain"
              loading="eager"
            />
          ) : (
            <span className="truncate font-heading text-[18px] font-extrabold uppercase tracking-[1px] text-on-surface md:text-[22px]">
              {config.name}
            </span>
          )}
        </Link>

        {/* Derecha: carrito */}
        <div className="flex items-center justify-end gap-3 md:gap-6">
          <button
            type="button"
            onClick={open}
            aria-label="Abrir carrito"
            className="relative inline-flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.5px] text-on-surface transition-colors hover:text-accent"
          >
            <svg className="sm:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="hidden sm:inline">CARRITO</span>
            {itemCount > 0 && (
              <span className="shape-circle absolute -right-3 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-on-accent sm:static sm:translate-y-0">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Barra de búsqueda desplegable (debajo del top bar, ancho completo) */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
          searchOpen ? 'max-h-24 border-t border-line opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <form onSubmit={submitSearch} className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 md:px-6">
          <Search className="h-5 w-5 shrink-0 text-on-surface-muted" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar productos..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              aria-label="Borrar búsqueda"
              className="flex h-7 w-7 items-center justify-center text-on-surface-muted hover:text-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="shrink-0 rounded-md bg-primary px-4 py-2 text-[13px] font-bold uppercase tracking-[0.5px] text-on-primary transition-transform hover:scale-[1.02]"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Overlay del menú (cierra al tocar fuera) */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer de navegación (slide in desde la izquierda) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        className={`fixed left-0 top-0 z-50 flex h-full w-[300px] max-w-[82vw] flex-col bg-background transition-transform duration-300 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <span className="font-heading text-[18px] font-extrabold uppercase tracking-[1px] text-on-surface">Menú</span>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="flex h-8 w-8 items-center justify-center text-on-surface hover:text-accent"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 py-4">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} className={drawerLink}>
              {item.label}
            </NavLink>
          ))}

          {/* Categorías (con subcategorías expandibles si las hay) */}
          <div>
            <div className="flex items-center justify-between">
              <NavLink to="/categorias" onClick={() => setMenuOpen(false)} className={drawerLink}>
                CATEGORÍAS
              </NavLink>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCatOpen((v) => !v)}
                  aria-label={catOpen ? 'Colapsar categorías' : 'Expandir categorías'}
                  aria-expanded={catOpen}
                  className="p-2 text-on-surface-muted hover:text-accent"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${catOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {categories.length > 0 && catOpen && (
              <div className="mb-1 ml-1.5 border-l border-line-soft pl-3">
                {categories.map((c) => (
                  <Link
                    key={c}
                    to={`/categoria/${encodeURIComponent(c)}`}
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 text-[13px] font-medium uppercase tracking-[0.5px] text-on-surface-muted transition-colors hover:text-accent"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Outfits: sólo si la tienda tiene la sección activa y hay outfits. */}
          {showOutfitsLink && (
            <button
              type="button"
              onClick={goToOutfits}
              className="block w-full py-3 text-left text-[15px] font-semibold uppercase tracking-[1px] text-on-surface transition-colors hover:text-accent"
            >
              Outfits
            </button>
          )}
        </nav>
      </aside>
    </header>
  );
}
