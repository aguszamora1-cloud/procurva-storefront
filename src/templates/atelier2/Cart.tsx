/**
 * Atelier 2 · A6: bolsa lateral y página /carrito.
 *
 * Sin lógica comercial propia. Las filas, los precios, el subtotal y el envío
 * gratis son los de useCartView (shared/ui → cartRows → lib/cartAmounts, lo
 * mismo que cobra el checkout); grupos «Lleva N», curvas y packs son una fila
 * indivisible: sin cantidad editable y «Quitar» quita el grupo entero, como el
 * tacho de Classic. Las plantillas no tocan el carrito directo
 * (atelier2-guards.test.mjs).
 *
 * Piezas de Classic, sin cambios, dentro de StoreSurface:
 *  - avisos de ahorro por cantidad (TemplateCartNudges, de useCartPromos);
 *  - «Ahorrás $X»: quantitySavings de useCartPromos, igual que la bolsa de Classic;
 *  - progreso de envío gratis (FreeShippingProgress, base freeShippingBase);
 *  - cupón con validación real (CouponCartBox), con los ítems con precio de
 *    useCartCoupon (el hook de lectura que usa useCartView);
 *  - complementarios (ComplementaryBlock contexto="carrito").
 * «Finalizar compra» lleva al checkout de Classic, sin cambios.
 */

import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { useStore, useStoreType } from '@/context/StoreProvider';
import { useCartCoupon } from '@/hooks/useCartCoupon';
import { useCartPromos } from '@/hooks/useCartPromos';
import { StoreImage } from '@/components/StoreImage';
import { Seo } from '@/components/Seo';
import { FreeShippingProgress } from '@/components/FreeShippingProgress';
import { CouponCartBox } from '@/components/CouponCartBox';
import { ComplementaryBlock } from '@/components/ComplementaryBlock';
import { freeShippingBase } from '@/lib/cartAmounts';
import { formatPrice } from '@/lib/utils';
import { TemplateCartNudges } from '../shared/ClassicExtras';
import { StoreSurface } from '../shared/StoreContent';
import { unitsLabel, useCartView, useCloseOnRoute, useOverlay } from '../shared/ui';
import { useAtelier2Palette } from './palette';

/** Líneas de la bolsa: foto, nombre, variante o detalle del grupo, cantidad, precio y quitar. */
function BagLines() {
  const { rows } = useCartView();
  return (
    <ul className="a2-lines">
      {rows.map((row) => (
        <li key={row.key} className="a2-line" data-group={row.group ?? undefined}>
          <Link to={`/producto/${row.productId}`} className="a2-line__img" tabIndex={-1} aria-hidden="true">
            {row.image ? <StoreImage src={row.image} alt="" transformWidth={300} width={150} height={200} /> : <span />}
          </Link>
          <div className="a2-line__b">
            <div className="a2-line__h">
              <Link to={`/producto/${row.productId}`} className="a2-line__n">
                {row.name}
              </Link>
              <p className="a2-line__p">
                <span className="a2-sr">Precio: </span>
                <b>{formatPrice(row.price.big)}</b>
                {row.price.strike != null && (
                  <s>
                    <span className="a2-sr">Antes </span>
                    {formatPrice(row.price.strike)}
                  </s>
                )}
              </p>
            </div>
            {row.item ? (
              <p className="a2-line__m">{[row.item.color, row.item.size && `Talle ${row.item.size}`].filter(Boolean).join(' · ')}</p>
            ) : (
              row.detail && <p className="a2-line__m a2-line__m--g">{row.detail}</p>
            )}
            {(row.unit != null || row.price.small != null) && (
              <p className="a2-line__m">
                {row.unit != null && <span>{formatPrice(row.unit)} c/u</span>}
                {row.price.small != null && (
                  <span>
                    {formatPrice(row.price.small)} {row.price.smallLabel}
                  </span>
                )}
              </p>
            )}
            <div className="a2-line__f">
              {row.qty ? (
                <div className="a2-qty" role="group" aria-label={`Cantidad de ${row.name}`}>
                  <button type="button" onClick={row.qty.dec} aria-label={`Quitar una unidad de ${row.name}`}>
                    <Minus aria-hidden="true" />
                  </button>
                  <span aria-live="polite">{row.units}</span>
                  <button type="button" onClick={row.qty.inc} aria-label={`Sumar una unidad de ${row.name}`}>
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <p className="a2-line__u">{unitsLabel(row.units)}</p>
              )}
              <button type="button" className="a2-line__x" onClick={row.remove} aria-label={`Quitar ${row.name}${row.group ? ' (todo el grupo)' : ''}`}>
                Quitar
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Subtotal, «Ahorrás» (useCartPromos, igual que Classic) y cupón aplicado. */
function BagTotals() {
  const { subtotal, couponCode } = useCartView();
  const { quantitySavings } = useCartPromos();
  return (
    <div className="a2-sum__t">
      <p className="a2-sum__row">
        <span>Subtotal</span>
        <span>
          {subtotal.strike != null && (
            <s>
              <span className="a2-sr">Antes </span>
              {formatPrice(subtotal.strike)}
            </s>
          )}
          <b>{formatPrice(subtotal.big)}</b>
        </span>
      </p>
      {subtotal.small != null && (
        <p className="a2-sum__note a2-sum__note--r">
          {formatPrice(subtotal.small)} {subtotal.smallLabel}
        </p>
      )}
      {quantitySavings > 0 && <p className="a2-sum__save">Ahorrás {formatPrice(quantitySavings)}</p>}
      {couponCode && <p className="a2-sum__note a2-sum__note--r">Con el cupón {couponCode}</p>}
    </div>
  );
}

/** Envío gratis y cupón: los componentes de Classic con los datos de useCartCoupon. */
function BagTools() {
  const coupon = useCartCoupon();
  const storeType = useStoreType();
  const { ink } = useAtelier2Palette();
  return (
    <StoreSurface ink={ink}>
      <div className="a2-sum__classic">
        <FreeShippingProgress subtotal={freeShippingBase(coupon)} />
        <CouponCartBox items={coupon.pricedItems} storeType={storeType ?? 'retail'} hasNonStackablePromo={coupon.hasNonStackablePromo} />
      </div>
    </StoreSurface>
  );
}

function BagCta({ onClose, page }: { onClose?: () => void; page?: boolean }) {
  return (
    <div className="a2-sum__cta">
      <Link to="/checkout" className="a2-btn" onClick={onClose}>
        Finalizar compra
      </Link>
      {page ? (
        <Link to="/productos" className="a2-btn a2-btn--line">
          Seguir comprando
        </Link>
      ) : (
        <Link to="/carrito" className="a2-btn a2-btn--line" onClick={onClose}>
          Ver bolsa completa
        </Link>
      )}
    </div>
  );
}

/** Complementarios del carrito (se ocultan solos si no hay nada que sugerir). */
function BagExtras() {
  const { ink } = useAtelier2Palette();
  return (
    <StoreSurface ink={ink}>
      <div className="a2-bagx">
        <ComplementaryBlock contexto="carrito" />
      </div>
    </StoreSurface>
  );
}

function Empty({ onClose }: { onClose?: () => void }) {
  return (
    <div className="a2-bagempty">
      <ShoppingBag aria-hidden="true" />
      <p>Tu bolsa está vacía.</p>
      <Link to="/productos" className="a2-btn a2-btn--line" onClick={onClose}>
        Ver todos los productos
      </Link>
    </div>
  );
}

/** Bolsa lateral: se abre al agregar un producto y con el botón «Bolsa» del encabezado. */
export function Atelier2Bag() {
  const { isOpen, close, rows, itemCount } = useCartView();
  const ref = useRef<HTMLElement>(null);
  useOverlay(isOpen, close, ref);
  useCloseOnRoute(close);
  if (!isOpen) return null;
  return (
    <>
      <div className="a2-scrim" onClick={close} aria-hidden="true" />
      <aside className="a2-sheet a2-sheet--r a2-bag" role="dialog" aria-modal="true" aria-labelledby="a2-bag-t" ref={ref}>
        <div className="a2-sheet__h">
          <h2 id="a2-bag-t">
            Bolsa{itemCount > 0 && <span> ({itemCount})</span>}
          </h2>
          <button type="button" className="a2-ib" onClick={close} aria-label="Cerrar la bolsa">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="a2-sheet__b a2-bag__b">
          {rows.length === 0 ? (
            <Empty onClose={close} />
          ) : (
            <>
              <TemplateCartNudges className="a2-nudge" />
              <BagLines />
              <BagTools />
              <BagExtras />
            </>
          )}
        </div>
        {rows.length > 0 && (
          <div className="a2-sheet__f a2-bag__f">
            <BagTotals />
            <BagCta onClose={close} />
          </div>
        )}
      </aside>
    </>
  );
}

/** Página /carrito: las mismas líneas y el mismo resumen, a dos columnas en escritorio. */
export function Atelier2CartPage() {
  const config = useStore();
  const { rows, itemCount } = useCartView();
  return (
    <div className="a2-wrap a2-cartp">
      <Seo title={`Bolsa · ${config.name}`} slug={config.slug} siteName={config.name} path="/carrito" noindex />
      <nav className="a2-crumbs" aria-label="Ruta">
        <Link to="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Bolsa</span>
      </nav>
      <h1>
        Tu bolsa{itemCount > 0 && <span className="a2-muted"> · {unitsLabel(itemCount)}</span>}
      </h1>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="a2-cartp__g">
          <div className="a2-cartp__l">
            <BagLines />
            <BagExtras />
          </div>
          <div className="a2-cartp__s">
            <div className="a2-sum">
              <TemplateCartNudges className="a2-nudge" />
              <BagTotals />
              <BagTools />
              <p className="a2-sum__note">El envío y los descuentos por medio de pago se calculan en el checkout.</p>
              <BagCta page />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
