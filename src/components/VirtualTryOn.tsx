import { useCallback, useRef, useState } from 'react';
import { AlertCircle, Camera, Download, Loader2, RefreshCw, Shirt, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type FashnCategory = 'auto' | 'tops' | 'bottoms' | 'one-pieces';
type Status = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

interface VirtualTryOnProps {
  /** URL pública de la imagen principal del producto (la prenda a probar). */
  garmentImageUrl: string;
  /** Nombre del producto (para el título y el nombre del archivo descargado). */
  garmentName: string;
  /** Categoría FASHN. Default 'auto'. Usá `mapFashnCategory` para derivarla del producto. */
  garmentCategory?: FashnCategory;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB antes de comprimir
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

/** Deriva la categoría FASHN a partir de las categorías del producto de ProCurva. */
export function mapFashnCategory(categories: string[] | null | undefined): FashnCategory {
  const cat = (categories ?? []).join(' ').toLowerCase();
  if (['remera', 'camisa', 'buzo', 'campera', 'sweater', 'musculosa', 'top', 'chomba', 'camiseta', 'abrigo', 'saco']
    .some((t) => cat.includes(t))) return 'tops';
  if (['pantalón', 'pantalon', 'jean', 'bermuda', 'short', 'pollera', 'falda', 'calza', 'jogger']
    .some((t) => cat.includes(t))) return 'bottoms';
  if (['vestido', 'enterito', 'mono', 'overall', 'mameluco', 'conjunto', 'jardinero']
    .some((t) => cat.includes(t))) return 'one-pieces';
  return 'auto';
}

/** Redimensiona a máx 1024px de ancho y devuelve un data URL JPEG calidad 0.85. */
function compressToJpegDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > MAX_DIMENSION ? MAX_DIMENSION / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo procesar la imagen'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'prenda';

/** Intenta extraer un mensaje legible del error de supabase.functions.invoke. */
async function readInvokeError(error: unknown): Promise<{ message: string; timeout: boolean }> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error === 'timeout') {
        return { message: body.message || 'La generación está tardando demasiado. Probá de nuevo.', timeout: true };
      }
      if (body?.error) return { message: body.error, timeout: false };
    } catch {
      /* respuesta sin JSON */
    }
  }
  return { message: 'No pudimos generar la imagen. Probá de nuevo en un momento.', timeout: false };
}

export function VirtualTryOn({ garmentImageUrl, garmentName, garmentCategory = 'auto' }: VirtualTryOnProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [userImage, setUserImage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setUserImage(null);
    setResultUrl(null);
    setErrorMsg('');
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Pequeño delay para no ver el reset durante la transición de cierre.
    setTimeout(reset, 200);
  }, [reset]);

  const handleFile = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setErrorMsg('Formato no soportado. Subí una imagen JPG, PNG o WEBP.');
      setStatus('error');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setErrorMsg('La imagen es demasiado pesada (máx 15MB).');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setErrorMsg('');
    try {
      const dataUrl = await compressToJpegDataUrl(file);
      setUserImage(dataUrl);
      setResultUrl(null);
      setStatus('idle');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'No se pudo procesar la imagen');
      setStatus('error');
    }
  }, []);

  const generate = useCallback(async () => {
    if (!userImage) return;
    setStatus('processing');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('fashn-tryon', {
        body: {
          model_image: userImage,
          garment_image_url: garmentImageUrl,
          category: garmentCategory,
          mode: 'balanced',
        },
      });
      if (error) {
        const { message } = await readInvokeError(error);
        setErrorMsg(message);
        setStatus('error');
        return;
      }
      const output: string[] | undefined = data?.output;
      if (data?.success && output && output.length > 0) {
        setResultUrl(output[0]);
        setStatus('completed');
      } else {
        setErrorMsg(data?.error || 'No pudimos generar la imagen. Probá de nuevo.');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Ocurrió un error inesperado. Probá de nuevo.');
      setStatus('error');
    }
  }, [userImage, garmentImageUrl, garmentCategory]);

  const download = useCallback(async () => {
    if (!resultUrl) return;
    const fileName = `probador-${slugify(garmentName)}.jpg`;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(resultUrl, '_blank', 'noopener');
    }
  }, [resultUrl, garmentName]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-accent px-6 py-[14px] text-[14px] font-semibold uppercase tracking-[0.03em] text-accent transition-colors hover:bg-accent hover:text-on-accent"
      >
        <Sparkles size={17} className="flex-none" />
        Probá cómo te queda
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Probador virtual — ${garmentName}`}
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/60" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 font-heading text-[16px] font-bold uppercase tracking-tight text-text">
                <Sparkles size={18} className="text-accent" /> Probador virtual
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-secondary hover:text-text"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              {/* Grid de previews: tu foto | la prenda */}
              <div className="grid grid-cols-2 gap-3">
                {/* Foto del usuario */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Tu foto</p>
                  {userImage ? (
                    <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line">
                      <img src={userImage} alt="Tu foto" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setUserImage(null); setResultUrl(null); setStatus('idle'); }}
                        aria-label="Cambiar foto"
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-2 text-center transition-colors ${
                        dragOver ? 'border-accent bg-accent/5' : 'border-line hover:border-accent/60 hover:bg-secondary'
                      }`}
                    >
                      {status === 'uploading' ? (
                        <Loader2 size={26} className="animate-spin text-accent" />
                      ) : (
                        <Camera size={26} className="text-subtle" />
                      )}
                      <span className="text-[12px] font-medium text-muted">
                        {status === 'uploading' ? 'Procesando…' : 'Subí tu foto'}
                      </span>
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </div>

                {/* Prenda */}
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">La prenda</p>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-secondary">
                    {garmentImageUrl ? (
                      <img src={garmentImageUrl} alt={garmentName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-subtle"><Shirt size={26} /></div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tips cuando no hay foto */}
              {!userImage && status !== 'error' && (
                <p className="mt-3 text-center text-[12px] leading-relaxed text-subtle">
                  Foto de cuerpo completo, fondo simple y buena iluminación para mejores resultados.
                </p>
              )}

              {/* Error */}
              {status === 'error' && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-[12px] text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-none" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Resultado */}
              {status === 'completed' && resultUrl && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Resultado</p>
                  <div className="overflow-hidden rounded-lg border border-line">
                    <img src={resultUrl} alt={`Probador — ${garmentName}`} className="w-full" />
                  </div>
                </div>
              )}

              {/* Procesando */}
              {status === 'processing' && (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-lg bg-secondary px-4 py-6 text-center">
                  <Loader2 size={28} className="animate-spin text-accent" />
                  <p className="text-[13px] font-medium text-text">Generando tu imagen…</p>
                  <p className="text-[12px] text-subtle">Esto puede tardar entre 5 y 15 segundos.</p>
                </div>
              )}
            </div>

            {/* Footer / acciones */}
            <div className="border-t border-line px-5 py-4">
              {status === 'completed' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center gap-2 rounded-[8px] border-[1.5px] border-line px-4 py-3 text-[13px] font-semibold uppercase tracking-wide text-text transition-colors hover:bg-secondary"
                  >
                    <RefreshCw size={16} /> Probar otra vez
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-primary px-4 py-3 text-[13px] font-bold uppercase tracking-wide text-on-primary transition-colors hover:bg-accent hover:text-on-accent"
                  >
                    <Download size={16} /> Descargar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={!userImage || status === 'processing' || status === 'uploading'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-primary px-6 py-[15px] text-[15px] font-bold uppercase tracking-[0.04em] text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary disabled:hover:text-on-primary"
                >
                  {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {status === 'processing' ? 'Generando…' : '¡Generar!'}
                </button>
              )}

              <p className="mt-3 text-center text-[11px] leading-relaxed text-subtle">
                Tu foto se usa únicamente para generar la imagen y no se almacena. Tecnología de IA — los resultados son aproximados.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
