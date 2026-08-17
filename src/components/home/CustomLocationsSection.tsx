import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { useLocations } from '@/hooks/useLocations';
import { useStore } from '@/context/StoreProvider';
import { whatsappLink } from '@/lib/utils';
import type {
  CustomSection,
  CustomSectionLocationsContent,
  CustomSectionVariant,
  StorefrontLocation,
  StorefrontLocationHours,
  StorefrontLocationType,
} from '@/lib/types';

const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Títulos derivados cuando el comercio no escribió uno propio. */
const TITLE_BY_TYPE: Record<StorefrontLocationType, string> = {
  local: 'Nuestros locales',
  showroom: 'Showrooms',
  pickup: 'Puntos de retiro',
  warehouse: 'Depósitos',
};

/**
 * Hora actual en Argentina, en minutos desde medianoche + día de la semana.
 * Se calcula con la zona horaria explícita: el visitante puede estar en otro
 * huso y "abierto ahora" tiene que responder al horario DEL LOCAL.
 */
function nowInArgentina(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // hour12:false devuelve "24" a medianoche en algunos runtimes.
  const hour = Number(get('hour')) % 24;
  return { day: DAY_INDEX[get('weekday')] ?? 0, minutes: hour * 60 + Number(get('minute') || 0) };
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m || 0);
};

/**
 * ¿Está abierto ahora? Sólo se puede responder con franjas cargadas: sin
 * `ranges` devuelve null (≠ false) y el pill directamente no se muestra.
 */
function isOpenNow(hours: StorefrontLocationHours | null): boolean | null {
  const ranges = hours?.ranges ?? [];
  if (ranges.length === 0) return null;
  const { day, minutes } = nowInArgentina();
  return ranges.some((r) => {
    if (r.day !== day || !r.open || !r.close) return false;
    const open = toMinutes(r.open);
    const close = toMinutes(r.close);
    // Franja que cruza la medianoche (cierra 01:00): se parte en dos tramos.
    return close <= open ? minutes >= open || minutes <= close : minutes >= open && minutes <= close;
  });
}

/** Horarios → texto compacto, agrupando los días con la misma franja. */
function hoursText(hours: StorefrontLocationHours | null): string {
  const ranges = hours?.ranges ?? [];
  if (ranges.length === 0) return (hours?.note ?? '').trim();
  const groups = new Map<string, number[]>();
  for (const r of ranges) {
    if (!r.open || !r.close) continue;
    const key = `${r.open}-${r.close}`;
    groups.set(key, [...(groups.get(key) ?? []), r.day]);
  }
  const text = [...groups.entries()]
    .map(([key, days]) => `${days.sort((a, b) => a - b).map((d) => DAYS_SHORT[d]).join(', ')} ${key}`)
    .join(' · ');
  const note = (hours?.note ?? '').trim();
  return note ? `${text} · ${note}` : text;
}

/**
 * EL punto en el que se puede confiar para mandar a alguien al negocio.
 *
 * Sólo las coordenadas con `coords_source === 'place'` (el punto del local).
 * Las de 'camera' son el encuadre del mapa y pueden estar a cuadras; las de
 * origen desconocido (filas anteriores a 20260772) no se pueden vouchear.
 *
 * Es UNA sola función a propósito: el mapa embebido, el link de "Cómo llegar" y
 * la etiqueta del botón tienen que estar de acuerdo siempre. Cuando cada uno
 * decidía por su cuenta, dejamos de dibujar el mapa corrido pero el botón
 * seguía ruteando al mismo punto malo — y una ruta es peor que un mapa: el
 * cliente maneja hasta ahí.
 */
const trustedPoint = (l: StorefrontLocation): { lat: number; lng: number } | null =>
  l.lat !== null && l.lng !== null && l.coords_source === 'place' ? { lat: l.lat, lng: l.lng } : null;

/**
 * URL del mapa embebible. SÓLO desde un punto confiable.
 *
 * Nunca se arma a partir de `address_line`: de las direcciones cargadas hoy en
 * producción, la mitad no tiene altura y una es un puesto de feria. Un mapa
 * armado con eso apunta a otra cuadra —o a otra ciudad— con toda la autoridad
 * de un pin. Sin punto confiable no hay mapa: del lado del visitante nadie
 * puede darse cuenta de que está corrido.
 */
function embedUrlFor(l: StorefrontLocation): string | null {
  const p = trustedPoint(l);
  return p ? `https://www.google.com/maps?q=${p.lat},${p.lng}&z=16&hl=es&output=embed` : null;
}

/**
 * Link de "Cómo llegar".
 *  - Con coordenadas: ruta directa al punto exacto.
 *  - Con link propio del comercio: ese link.
 *  - Sin ninguno: una BÚSQUEDA en Maps con el texto de la dirección. Es una
 *    búsqueda, no un pin: el visitante ve lo que Google encontró y decide. Por
 *    eso no contradice la regla de no dibujar un mapa desde `address_line`.
 */
function directionsUrl(l: StorefrontLocation): string {
  const p = trustedPoint(l);
  if (p) return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  // Sin punto confiable NO se rutea a las coordenadas guardadas: si son el
  // encuadre del mapa, la ruta lleva al cliente a cuadras del negocio y encima
  // con la confianza de un GPS. El link del comercio, o la búsqueda por la
  // dirección escrita, son peores en precisión pero honestos en su promesa.
  if (l.maps_url) return l.maps_url;
  const query = [l.address_line, l.city, l.province].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Qué promete el botón, que tiene que ser exactamente lo que el botón hace.
 *
 *  - Con coordenadas → abre una RUTA a un punto exacto: "Cómo llegar".
 *  - Con el link del comercio pero sin coordenadas → abre ESE lugar en Maps.
 *    No es una ruta, pero tampoco una búsqueda a ver qué sale: "Ver en Maps".
 *  - Sin nada → una BÚSQUEDA por el texto de la dirección, que puede devolver
 *    otra cosa o nada: "Buscar en Maps". Prometer "cómo llegar" acá sería
 *    prometer una precisión que no tenemos.
 */
const directionsLabel = (l: StorefrontLocation): string => {
  if (trustedPoint(l)) return 'Cómo llegar';
  return l.maps_url ? 'Ver en Maps' : 'Buscar en Maps';
};

/**
 * NO hay un botón "Ver mapa" aparte.
 *
 * Lo hubo y era un duplicado: cuando no se puede embeber, `directionsUrl` ya
 * cae al `maps_url` del comercio, así que "Ver mapa" y el botón de destino
 * abrían LA MISMA URL, uno arriba del otro. Un solo botón por destino.
 *
 * El mapa embebible, cuando existe, vive en el bloque de medios de la card
 * (LocationMedia), no entre los botones.
 */

/** Placeholder del mapa: sugiere que hay uno sin descargar nada de Google. */
function MapPlaceholder({ label }: { label: string }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <span className="relative flex items-center gap-2 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-surface">
        <MapPin className="h-4 w-4" />
        {label}
      </span>
    </>
  );
}

/**
 * Medios de la card: la foto y el mapa, en un mismo bloque.
 *
 * Con las dos cosas cargadas se convierte en un carrusel de dos slides (foto →
 * mapa). Apiladas se comían media pantalla y el visitante nunca veía las dos:
 * una quedaba arriba del texto y la otra abajo. Con una sola de las dos no hay
 * carrusel ni puntitos — no hay nada que deslizar.
 *
 * El facade se mantiene: el `<iframe>` de Google recién se monta cuando el
 * visitante llega al slide del mapa. Deslizar es una intención tan explícita
 * como tocar "Ver mapa". Una vez montado no se desmonta al volver a la foto,
 * para no recargarlo en cada swipe.
 */
function LocationMedia({
  location,
  showPhoto,
  tall,
}: {
  location: StorefrontLocation;
  showPhoto: boolean;
  tall: boolean;
}) {
  const [active, setActive] = useState(0);
  const [mapSeen, setMapSeen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  const photoUrl = showPhoto ? location.photo_url : null;
  const embed = embedUrlFor(location);
  const height = tall ? 'h-56 md:h-64' : 'h-44';

  /**
   * El mapa se carga SOLO, sin que el visitante tenga que tocar nada — pero
   * recién cuando la sección está por entrar en pantalla.
   *
   * El facade a botón protegía el peso de la página (el embed de Google trae
   * cerca de un mega y sus cookies), pero le pedía un clic al visitante para ver
   * algo que ya debería estar. Con IntersectionObserver se queda con lo bueno de
   * las dos: quien nunca baja hasta acá no descarga nada, y quien llega lo ve ya
   * puesto. `rootMargin` lo dispara 200px antes, así llega cargado.
   */
  useEffect(() => {
    const el = blockRef.current;
    if (!el || mapSeen || !embed) return;
    const io = new IntersectionObserver(
      (entries) => {
        // La ÚLTIMA entry es el estado actual. Si en un mismo callback llegan
        // varias y sólo se mira la primera, se actúa sobre información vieja.
        const last = entries[entries.length - 1];
        if (last?.isIntersecting) {
          setMapSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mapSeen, embed]);

  // En el carrusel, llegar al slide del mapa también lo monta (por si el
  // visitante desliza antes de que el observer haya disparado).
  useEffect(() => {
    if (photoUrl && embed && active === 1) setMapSeen(true);
  }, [active, photoUrl, embed]);

  if (!photoUrl && !embed) return null;

  // Sólo foto.
  if (photoUrl && !embed) {
    return <img src={photoUrl} alt={location.name} loading="lazy" className={`w-full object-cover ${height}`} />;
  }

  // Sólo mapa: se monta solo al entrar en pantalla. El placeholder es lo que se
  // ve durante ese instante (y si el observer no existiera), no un botón: ya no
  // hay que tocar nada.
  if (!photoUrl && embed) {
    return (
      <div ref={blockRef} className={`relative flex w-full items-center justify-center overflow-hidden bg-secondary ${height}`}>
        {mapSeen ? (
          <iframe
            src={embed}
            title={`Mapa de ${location.name}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-full w-full border-0"
          />
        ) : (
          <MapPlaceholder label="Cargando el mapa…" />
        )}
      </div>
    );
  }

  // Las dos: carrusel.
  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative" ref={blockRef}>
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className={`w-full shrink-0 snap-center ${height}`}>
          <img src={photoUrl as string} alt={location.name} loading="lazy" className="h-full w-full object-cover" />
        </div>
        <div className={`relative flex w-full shrink-0 snap-center items-center justify-center bg-secondary ${height}`}>
          {mapSeen ? (
            <iframe
              src={embed as string}
              title={`Mapa de ${location.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full w-full border-0"
            />
          ) : (
            <MapPlaceholder label="Deslizá para ver el mapa" />
          )}
        </div>
      </div>

      {/* Puntitos. Sin esto la foto se lee como una imagen fija y nadie descubre
          que atrás hay un mapa. Van sobre negro semitransparente porque abajo
          puede haber una foto clara. */}
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {['Ver la foto', 'Ver el mapa'].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${label} de ${location.name}`}
            className={`h-1.5 rounded-full shadow ring-1 ring-black/20 transition-all ${
              i === active ? 'w-5 bg-white' : 'w-1.5 bg-white/70 hover:bg-white'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Una ubicación, a ancho completo.
 *
 * `solo` = es la ÚNICA del comercio. No es lo mismo una card que compite con
 * otras dos en una fila que una sola en el medio de la sección: cuando es una,
 * deja de ser un ítem de una lista y pasa a ser el contenido de la sección, así
 * que gana jerarquía (foto y nombre más grandes) y los botones ocupan el ancho
 * completo en vez de amontonarse a la izquierda.
 */
function LocationCard({ location, solo = false }: { location: StorefrontLocation; solo?: boolean }) {
  const config = useStore();
  const open = isOpenNow(location.hours);
  const hours = hoursText(location.hours);
  const type = location.location_type;
  // El punto de retiro no se "visita": no lleva foto de la fachada y el texto
  // apunta a buscar un pedido, no a pasear.
  //
  // El MAPA sí va (2026-08-10). La razón de no mostrar foto es no promocionar
  // una visita que no queremos; el mapa no promociona nada, contesta "¿dónde
  // queda?" — que es exactamente lo que necesita quien va a retirar.
  const showPhoto = type !== 'pickup' && !!location.photo_url;
  // El showroom con cita previa no muestra horario fijo: el horario lo define
  // la cita, y publicar uno invita a caer sin avisar.
  const showHours = !!hours && !(type === 'showroom' && location.by_appointment);
  // WhatsApp: el del local si tiene uno propio, y si no el de la tienda. Sin
  // este fallback, dejar el campo vacío borraba el botón — y el comercio que no
  // lo llena no está diciendo "no quiero que me escriban", está diciendo "es el
  // mismo de siempre".
  const waNumber = location.whatsapp || config.whatsapp;
  const wa = waNumber
    ? whatsappLink(
        waNumber,
        type === 'showroom'
          ? `Hola! Quería coordinar una visita a ${location.name}.`
          : `Hola! Quería consultar por ${location.name}.`,
      )
    : '';

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <LocationMedia location={location} showPhoto={showPhoto} tall={solo} />
      <div className={`space-y-3 ${solo ? 'p-6' : 'p-5'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className={`font-heading font-semibold text-text ${
              solo ? 'text-[calc(21px_*_var(--font-scale,1))] md:text-[calc(25px_*_var(--font-scale,1))]' : 'text-[calc(17px_*_var(--font-scale,1))] md:text-[calc(19px_*_var(--font-scale,1))]'
            }`}
          >
            {location.name}
          </h3>
          {open !== null && (
            <span
              className={`rounded-pill px-2 py-0.5 text-[calc(11px_*_var(--font-scale,1))] font-medium ${
                open ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-secondary text-muted'
              }`}
            >
              {open ? 'Abierto ahora' : 'Cerrado ahora'}
            </span>
          )}
          {type === 'showroom' && location.by_appointment && (
            <span className="rounded-pill bg-secondary px-2 py-0.5 text-[calc(11px_*_var(--font-scale,1))] font-medium text-muted">Con cita previa</span>
          )}
        </div>

        <p className={`flex items-start gap-2 text-on-surface ${solo ? 'text-[calc(16px_*_var(--font-scale,1))]' : 'text-[calc(14px_*_var(--font-scale,1))]'}`}>
          <MapPin className={`mt-0.5 shrink-0 text-muted ${solo ? 'h-5 w-5' : 'h-4 w-4'}`} />
          <span>
            {location.address_line}
            {(location.city || location.province) && (
              <span className={`block text-muted ${solo ? 'text-[calc(14px_*_var(--font-scale,1))]' : 'text-[calc(13px_*_var(--font-scale,1))]'}`}>
                {[location.city, location.province].filter(Boolean).join(', ')}
              </span>
            )}
          </span>
        </p>

        {/* Sin horarios cargados esta línea no existe. Nada de "sin horarios". */}
        {showHours && (
          <p className="flex items-start gap-2 text-[calc(13px_*_var(--font-scale,1))] text-muted">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{hours}</span>
          </p>
        )}

        {type === 'pickup' && (
          <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">Retirás con el número de pedido.</p>
        )}

        {location.notes && <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">{location.notes}</p>}


        {/* Con una sola ubicación los botones van apilados y a ancho completo:
            en una card de 480px centrada, tres botones sueltos a la izquierda
            dejan la mitad derecha vacía y se leen como un sobrante. */}
        <div className={`gap-2 pt-1 ${solo ? 'flex flex-col' : 'flex flex-wrap'}`}>
          <a
            href={directionsUrl(location)}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-primary transition-colors hover:bg-accent hover:text-on-accent ${
              solo ? 'w-full' : ''
            }`}
          >
            {directionsLabel(location)}
          </a>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-5 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:border-accent hover:text-accent ${solo ? 'w-full' : ''}`}
            >
              <MessageCircle className="h-4 w-4" />
              {type === 'showroom' ? 'Coordinar visita' : 'WhatsApp'}
            </a>
          )}
          {location.phone && (
            <a
              href={`tel:${location.phone.replace(/\s/g, '')}`}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-5 text-[calc(14px_*_var(--font-scale,1))] font-medium text-on-surface transition-colors hover:border-accent hover:text-accent ${solo ? 'w-full' : ''}`}
            >
              <Phone className="h-4 w-4" />
              Llamar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Versión reducida para la columna derecha de la ficha (267px a 768px). */
function LocationRow({ location }: { location: StorefrontLocation }) {
  return (
    <div className="border-b border-line-soft py-2.5 last:border-0">
      <p className="text-[calc(13px_*_var(--font-scale,1))] font-medium text-on-surface">{location.name}</p>
      <p className="truncate text-[calc(12px_*_var(--font-scale,1))] text-muted">{location.address_line}</p>
      <a
        href={directionsUrl(location)}
        target="_blank"
        rel="noreferrer"
        className="mt-0.5 inline-block text-[calc(12px_*_var(--font-scale,1))] font-medium text-accent hover:underline"
      >
        {directionsLabel(location)}
      </a>
    </div>
  );
}

/**
 * "Dónde encontrarnos": las ubicaciones físicas del comercio.
 *
 * Los datos NO vienen del content de la sección: vienen de `storefront_locations`
 * (una sola fuente, la misma que alimenta el retiro en el checkout). El content
 * sólo guarda el título y, opcionalmente, cuáles mostrar.
 */
export function CustomLocationsSection({
  section,
  variant = 'default',
}: {
  section: CustomSection;
  variant?: CustomSectionVariant;
}) {
  const c = section.content as CustomSectionLocationsContent;
  const { locations } = useLocations();
  const [tab, setTab] = useState(0);

  // El pill "Abierto ahora" se recalcula solo: una pestaña abierta un rato largo
  // no puede quedar diciendo "abierto" después del cierre.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const shown = useMemo(() => {
    const ids = c.location_ids;
    if (!ids || ids.length === 0) return locations;
    // Se respeta el orden en que el comercio las eligió; las que ya no existen
    // (o se desactivaron) se caen solas.
    const byId = new Map(locations.map((l) => [l.id, l]));
    return ids.map((id) => byId.get(id)).filter((l): l is StorefrontLocation => !!l);
  }, [c.location_ids, locations]);

  if (shown.length === 0) return null;

  const title =
    (c.title || '').trim() ||
    (shown.every((l) => l.location_type === shown[0].location_type)
      ? TITLE_BY_TYPE[shown[0].location_type]
      : 'Dónde encontrarnos');

  // Columna derecha de la ficha: versión reducida, sin mapa ni foto. Ahí el
  // contenedor ya pone ancho y ritmo vertical.
  if (variant === 'column') {
    return (
      <div>
        <p className="mb-1.5 text-[calc(13px_*_var(--font-scale,1))] font-semibold text-on-surface">{title}</p>
        {shown.map((l) => (
          <LocationRow key={l.id} location={l} />
        ))}
      </div>
    );
  }

  const active = shown[Math.min(tab, shown.length - 1)];

  return (
    <section className="mx-auto max-w-none px-6 py-8 md:py-16">
      <SectionHeader title={title} />
      {/* El layout sale de CUÁNTAS hay, no de una config:
          1  → una card centrada y angosta. Una sola card estirada a lo ancho de
               la pantalla, o metida en la primera celda de una grilla de tres,
               se lee como si faltaran las otras dos.
          2-3 → grilla repartida, cada una ocupando su parte.
          4+ → tabs: cuatro cards apiladas ya son un scroll largo y conviene que
               el visitante elija cuál mirar. */}
      {shown.length === 1 ? (
        <div className="mx-auto max-w-[480px]">
          <LocationCard location={shown[0]} solo />
        </div>
      ) : shown.length <= 3 ? (
        <div className={`grid gap-4 ${shown.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {shown.map((l) => (
            <LocationCard key={l.id} location={l} />
          ))}
        </div>
      ) : (
        <div>
          <div role="tablist" aria-label={title} className="mb-4 flex flex-wrap gap-2">
            {shown.map((l, i) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => setTab(i)}
                className={`rounded-pill border px-4 py-2 text-[calc(14px_*_var(--font-scale,1))] transition-colors ${
                  i === tab
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line text-on-surface hover:border-accent hover:text-accent'
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
          <div className="md:max-w-xl">
            <LocationCard location={active} />
          </div>
        </div>
      )}
    </section>
  );
}
