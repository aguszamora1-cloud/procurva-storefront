import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Camera, CheckCircle2, Clock, Loader2, MessageSquareOff, Star, X } from 'lucide-react';
import { useStore } from '@/context/StoreProvider';
import { useFirstPaintGate } from '@/context/FirstPaintContext';
import { Seo } from '@/components/Seo';
import {
  compressPhoto,
  fetchReviewRequest,
  submitReviews,
  type ReviewRequestInfo,
  type ReviewRequestItem,
} from '@/lib/reviews';

/**
 * /resena/:token — el cliente deja su opinión de lo que compró.
 *
 * Llega por el link único de su venta (email automático, WhatsApp, o el botón
 * "Pedir reseña" del ERP). El token es lo único que lo identifica: no hay login.
 * Las de 4 y 5 estrellas sin fotos se publican solas; el resto las revisa la
 * tienda (lo decide submit-product-review, no esta página).
 */

const MAX_PHOTOS = 3;
const MAX_TEXT = 1000;

const inputCls =
  'w-full rounded-button border border-line bg-background px-3.5 py-2.5 text-[length:max(16px,calc(16px_*_var(--font-scale,1)))] font-normal text-text outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-a25';
const labelCls = 'text-[calc(13px_*_var(--font-scale,1))] font-medium text-muted';

interface Draft {
  rating: number;
  text: string;
  photos: string[];
}

const RATING_LABELS = ['', 'No me gustó', 'Regular', 'Está bien', 'Me gustó', 'Me encantó'];

function StarPicker({ value, onChange, name }: { value: number; onChange: (v: number) => void; name: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={`Puntaje para ${name}`} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Star
              width={30}
              height={30}
              strokeWidth={1.5}
              className={n <= shown ? 'fill-amber-400 text-amber-400' : 'text-line'}
            />
          </button>
        ))}
      </div>
      <p className="mt-1 min-h-[20px] text-[calc(13px_*_var(--font-scale,1))] text-muted">{RATING_LABELS[shown]}</p>
    </div>
  );
}

function ItemForm({
  item,
  draft,
  onChange,
}: {
  item: ReviewRequestItem;
  draft: Draft;
  onChange: (d: Draft) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotoError('');
    setProcessing(true);
    const room = MAX_PHOTOS - draft.photos.length;
    const next = [...draft.photos];
    for (const file of Array.from(files).slice(0, room)) {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        setPhotoError('Subí fotos en JPG, PNG o WEBP.');
        continue;
      }
      try {
        next.push(await compressPhoto(file));
      } catch {
        setPhotoError('No pudimos leer una de las fotos. Probá con otra.');
      }
    }
    onChange({ ...draft, photos: next });
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-line bg-background p-4 md:p-5">
      <div className="flex items-center gap-3">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-md bg-secondary" />
        )}
        <div className="min-w-0">
          <p className="text-[calc(15px_*_var(--font-scale,1))] font-semibold text-text">{item.name}</p>
          {item.variant && <p className="text-[calc(13px_*_var(--font-scale,1))] text-muted">{item.variant}</p>}
        </div>
      </div>

      {item.reviewed ? (
        <p className="mt-4 flex items-center gap-2 text-[calc(14px_*_var(--font-scale,1))] text-muted">
          <CheckCircle2 width={16} height={16} className="shrink-0" />
          Ya dejaste tu opinión sobre este producto.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <StarPicker value={draft.rating} onChange={(rating) => onChange({ ...draft, rating })} name={item.name} />

          {draft.rating > 0 && (
            <>
              <label className="block space-y-1.5">
                <span className={labelCls}>Contanos más (opcional)</span>
                <textarea
                  value={draft.text}
                  maxLength={MAX_TEXT}
                  rows={3}
                  onChange={(e) => onChange({ ...draft, text: e.target.value })}
                  placeholder="¿Cómo te quedó? ¿Qué te gustó de la calidad, el talle, la tela?"
                  className={`${inputCls} resize-y`}
                />
              </label>

              <div className="space-y-2">
                <span className={labelCls}>Fotos (opcional, hasta {MAX_PHOTOS})</span>
                <div className="flex flex-wrap gap-2">
                  {draft.photos.map((src, i) => (
                    <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md bg-secondary">
                      <img src={src} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label="Quitar foto"
                        onClick={() => onChange({ ...draft, photos: draft.photos.filter((_, j) => j !== i) })}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-pill bg-background text-text shadow-card"
                      >
                        <X width={14} height={14} />
                      </button>
                    </div>
                  ))}
                  {draft.photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={processing}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-[calc(12px_*_var(--font-scale,1))] text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      {processing ? <Loader2 width={18} height={18} className="animate-spin" /> : <Camera width={18} height={18} />}
                      Agregar
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  multiple
                  className="hidden"
                  onChange={(e) => addPhotos(e.target.files)}
                />
                {photoError && <p className="text-[calc(13px_*_var(--font-scale,1))] text-red-600">{photoError}</p>}
                {draft.photos.length > 0 && (
                  <p className="text-[calc(12px_*_var(--font-scale,1))] text-subtle">
                    Las reseñas con fotos se publican después de que la tienda las revise.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusScreen({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center md:py-28">
      <div className="text-subtle">{icon}</div>
      <h1 className="mt-4 font-heading text-[calc(24px_*_var(--font-scale,1))] font-bold tracking-tight text-text md:text-[calc(28px_*_var(--font-scale,1))]">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-[calc(15px_*_var(--font-scale,1))] text-muted">{text}</p>
      <Link
        to="/productos"
        className="mt-8 rounded-button bg-primary px-8 py-3.5 text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-primary transition-all hover:bg-accent hover:text-on-accent"
      >
        Ver la tienda
      </Link>
    </div>
  );
}

export function Resena() {
  const { token = '' } = useParams<{ token: string }>();
  const config = useStore();
  const [info, setInfo] = useState<ReviewRequestInfo | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ published: number; pending: number } | null>(null);

  useFirstPaintGate('resena', info === null);

  useEffect(() => {
    if (!config.companyId) return;
    let cancelled = false;
    fetchReviewRequest(token.toLowerCase(), config.companyId).then((data) => {
      if (cancelled) return;
      setInfo(data);
      // Nombre sugerido: el de pila + la inicial del apellido.
      const first = data.customer_name?.trim() || '';
      const initial = data.customer_last_initial?.trim();
      setDisplayName(first ? `${first}${initial ? ` ${initial.toUpperCase()}.` : ''}` : '');
    });
    return () => {
      cancelled = true;
    };
  }, [token, config.companyId]);

  const seo = <Seo title={`Tu opinión · ${config.name}`} slug={config.slug} noindex />;

  if (info === null) return <div className="min-h-[60dvh]" aria-busy="true">{seo}</div>;

  if (result) {
    return (
      <>
        {seo}
        <StatusScreen
          icon={<CheckCircle2 width={40} height={40} strokeWidth={1.5} />}
          title="¡Gracias por tu opinión!"
          text={
            result.pending > 0
              ? 'La recibimos. La tienda la revisa antes de publicarla, así que puede tardar un poco en aparecer.'
              : 'Ya está publicada. Le va a servir a mucha gente para elegir.'
          }
        />
      </>
    );
  }

  if (info.status === 'expired') {
    return (
      <>
        {seo}
        <StatusScreen
          icon={<Clock width={40} height={40} strokeWidth={1.5} />}
          title="Este link venció"
          text="Si querés dejar tu opinión, escribile a la tienda y te mandan uno nuevo."
        />
      </>
    );
  }

  if (info.status === 'completed') {
    return (
      <>
        {seo}
        <StatusScreen
          icon={<CheckCircle2 width={40} height={40} strokeWidth={1.5} />}
          title="Ya dejaste tu opinión"
          text="Recibimos tu opinión sobre esta compra. ¡Gracias por tomarte el tiempo!"
        />
      </>
    );
  }

  if (info.status !== 'ok' || !info.items?.length) {
    return (
      <>
        {seo}
        <StatusScreen
          icon={<MessageSquareOff width={40} height={40} strokeWidth={1.5} />}
          title="No encontramos este link"
          text={
            info.status === 'error'
              ? 'Hubo un problema al abrirlo. Probá de nuevo en un momento.'
              : 'Revisá que el link esté completo o pedile uno nuevo a la tienda.'
          }
        />
      </>
    );
  }

  const items = info.items;
  const pendingItems = items.filter((i) => !i.reviewed);
  const draftFor = (id: string): Draft => drafts[id] ?? { rating: 0, text: '', photos: [] };
  const rated = pendingItems.filter((i) => draftFor(i.product_id).rating > 0);
  const canSubmit = rated.length > 0 && displayName.trim().length > 0 && !submitting;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !config.companyId) return;
    setError('');
    setSubmitting(true);
    const res = await submitReviews({
      token: token.toLowerCase(),
      companyId: config.companyId,
      displayName: displayName.trim(),
      reviews: rated.map((i) => {
        const d = draftFor(i.product_id);
        return { product_id: i.product_id, rating: d.rating, text: d.text.trim(), photos: d.photos };
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      setResult({ published: res.published, pending: res.pending });
      window.scrollTo({ top: 0 });
    } else {
      setError(res.error);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      {seo}
      <h1 className="font-heading text-[calc(26px_*_var(--font-scale,1))] font-bold tracking-tight text-text md:text-[calc(32px_*_var(--font-scale,1))]">
        ¿Qué te pareció tu compra?
      </h1>
      <p className="mt-2 text-[calc(15px_*_var(--font-scale,1))] text-muted">
        {info.customer_name ? `Hola ${info.customer_name}, c` : 'C'}ontanos cómo te fue. Tu opinión ayuda a otras
        personas a elegir. {pendingItems.length > 1 && 'Podés opinar de uno solo o de todos.'}
      </p>

      <div className="mt-8 space-y-3">
        {items.map((item) => (
          <ItemForm
            key={item.product_id}
            item={item}
            draft={draftFor(item.product_id)}
            onChange={(d) => setDrafts((prev) => ({ ...prev, [item.product_id]: d }))}
          />
        ))}
      </div>

      {pendingItems.length > 0 && (
        <div className="mt-8 space-y-4">
          <label className="block space-y-1.5">
            <span className={labelCls}>Tu nombre (así aparece en la reseña)</span>
            <input
              type="text"
              value={displayName}
              maxLength={40}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ej: Juana P."
              className={inputCls}
            />
          </label>

          {error && (
            <p role="alert" className="text-[calc(14px_*_var(--font-scale,1))] text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-button bg-primary px-8 py-3.5 text-[calc(15px_*_var(--font-scale,1))] font-medium text-on-primary transition-all hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 width={18} height={18} className="animate-spin" />}
            {submitting ? 'Enviando…' : 'Enviar mi opinión'}
          </button>
          {rated.length === 0 && (
            <p className="text-center text-[calc(13px_*_var(--font-scale,1))] text-subtle">
              Elegí las estrellas de al menos un producto.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
