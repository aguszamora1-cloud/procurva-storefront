import { Search, X } from 'lucide-react';
import { useHeader } from './HeaderContext';

/**
 * Barra de búsqueda desplegable, debajo de la barra del encabezado y a todo el
 * ancho. Lleva el fondo propio del encabezado, igual que la barra.
 */
export function SearchPanel() {
  const { searchOpen, searchQuery, setSearchQuery, searchInputRef, submitSearch, headerVars } = useHeader();

  return (
    <div
      style={headerVars}
      className={`overflow-hidden bg-background transition-[max-height,opacity] duration-300 ${
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
          className="min-w-0 flex-1 bg-transparent text-[calc(15px_*_var(--font-scale,1))] text-on-surface placeholder:text-on-surface-muted focus:outline-none"
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
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-primary transition-transform hover:scale-[1.02]"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
