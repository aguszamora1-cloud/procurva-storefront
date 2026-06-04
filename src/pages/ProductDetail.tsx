import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eye, MessageCircle, ShoppingBag } from 'lucide-react';
import { useProduct } from '@/hooks/useProduct';
import { useStore } from '@/context/StoreProvider';
import { useCart } from '@/context/CartContext';
import { ProductGallery } from '@/components/ProductGallery';
import { ShippingPromise } from '@/components/ShippingPromise';
import {
  colorToHex,
  formatPrice,
  productImages,
  retailPrice,
  sortSizes,
} from '@/lib/utils';
import { buildWhatsappInquiry } from '@/lib/checkout';
import type { Variant } from '@/lib/types';

// "X personas viendo" determinístico (sin Math.random para estabilidad).
function viewersFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 6 + (h % 18);
}

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { product, isLoading, error } = useProduct(id);
  const config = useStore();
  const { addItem } = useCart();

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const variants: Variant[] = product?.product_variants ?? [];
  const colors = useMemo(
    () => Array.from(new Set(variants.filter((v) => v.color).map((v) => v.color as string))),
    [variants],
  );
  const sizes = useMemo(
    () => sortSizes(Array.from(new Set(variants.filter((v) => v.size).map((v) => v.size as string)))),
    [variants],
  );

  const stockFor = (color: string | null, size: string | null): number =>
    variants
      .filter((v) => (!colors.length || v.color === color) && (!sizes.length || v.size === size))
      .reduce((sum, v) => sum + Math.max(0, v.stock ?? 0), 0);

  const sizeAvailable = (size: string): boolean =>
    variants.some(
      (v) =>
        v.size === size &&
        (!colors.length || !selectedColor || v.color === selectedColor) &&
        (v.stock ?? 0) > 0,
    );

  // Galería: si hay color elegido con imagen propia, saltar a ella.
  const images = product ? productImages(product) : [];
  const activeImageIndex = useMemo(() => {
    if (!selectedColor) return undefined;
    const variantImg = variants.find((v) => v.color === selectedColor && v.image_url)?.image_url;
    if (!variantImg) return undefined;
    const idx = images.indexOf(variantImg);
    return idx >= 0 ? idx : undefined;
  }, [selectedColor, variants, images]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse bg-secondary" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse bg-secondary" />
            <div className="h-6 w-1/3 animate-pulse bg-secondary" />
            <div className="h-24 animate-pulse bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl">Producto no encontrado</h1>
        <Link to="/productos" className="btn-outline mt-6 inline-block px-6 py-3 text-sm">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const price = retailPrice(product);
  const needColor = colors.length > 0;
  const needSize = sizes.length > 0;

  const handleAdd = () => {
    if (needColor && !selectedColor) {
      setFeedback('Elegí un color');
      return;
    }
    if (needSize && !selectedSize) {
      setFeedback('Elegí un talle');
      return;
    }
    const variant = variants.find(
      (v) =>
        (!needColor || v.color === selectedColor) &&
        (!needSize || v.size === selectedSize),
    );
    if (!variant || (variant.stock ?? 0) <= 0) {
      setFeedback('Sin stock para esa combinación');
      return;
    }
    addItem({
      product_id: product.id,
      variant_id: variant.id,
      name: product.name,
      size: variant.size,
      color: variant.color,
      unit_price: variant.price && variant.price > 0 ? variant.price : price,
      qty: 1,
      image_url: variant.image_url ?? images[0] ?? null,
    });
    setFeedback(null);
  };

  const inquiry = buildWhatsappInquiry(config, product.name);
  const currentStock = stockFor(selectedColor, selectedSize);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Link to="/productos" className="subtitle-label text-muted hover:text-accent">
          ← Volver
        </Link>

        <div className="mt-4 grid gap-10 md:grid-cols-2">
          <ProductGallery images={images} alt={product.name} activeIndex={activeImageIndex} />

          <div>
            <h1 className="text-2xl md:text-3xl">{product.name}</h1>
            <p className="price mt-3 text-2xl">{formatPrice(price)}</p>

            {config.sections.socialProof && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted animate-fade-in">
                <Eye size={15} /> {viewersFromId(product.id)} personas viendo este producto
              </p>
            )}

            {product.description && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">
                {product.description}
              </p>
            )}

            {/* Colores */}
            {needColor && (
              <div className="mt-6">
                <p className="subtitle-label mb-2">Color{selectedColor ? `: ${selectedColor}` : ''}</p>
                <div className="flex flex-wrap gap-2">
                  {colors.map((c) => (
                    <button
                      key={c}
                      title={c}
                      onClick={() => {
                        setSelectedColor(c);
                        setSelectedSize(null);
                      }}
                      className={`shape-circle h-8 w-8 border-2 transition ${
                        selectedColor === c ? 'border-accent' : 'border-line'
                      }`}
                      style={{ backgroundColor: colorToHex(c) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Talles */}
            {needSize && (
              <div className="mt-6">
                <p className="subtitle-label mb-2">Talle</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const avail = sizeAvailable(s);
                    return (
                      <button
                        key={s}
                        disabled={!avail}
                        onClick={() => setSelectedSize(s)}
                        className={`min-w-[3rem] border px-3 py-2 text-sm font-semibold transition ${
                          selectedSize === s
                            ? 'border-accent bg-accent text-[var(--color-on-accent)]'
                            : 'border-line hover:border-accent'
                        } ${!avail ? 'cursor-not-allowed opacity-40 line-through' : ''}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStock > 0 && currentStock <= 5 && (selectedSize || !needSize) && (
              <p className="mt-3 text-sm font-semibold text-accent animate-fade-in">
                ¡Últimas {currentStock} unidades!
              </p>
            )}

            {feedback && <p className="mt-4 text-sm text-accent">{feedback}</p>}

            <div className="mt-6 flex flex-col gap-3">
              <button onClick={handleAdd} className="btn-primary flex items-center justify-center gap-2 py-4 text-sm">
                <ShoppingBag size={18} /> Agregar al carrito
              </button>
              {inquiry && (
                <a
                  href={inquiry}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline flex items-center justify-center gap-2 py-4 text-sm"
                >
                  <MessageCircle size={18} /> Consultar por WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShippingPromise />
    </div>
  );
}
