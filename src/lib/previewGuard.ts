/**
 * EDITOR E2.0b · protección de operaciones reales dentro de la vista previa.
 *
 * Dentro del diseñador del ERP la tienda es la REAL: sin esto, el comercio podía
 * crear un pedido (y una venta), iniciar un cobro, suscribirse al newsletter o
 * gastar créditos del probador desde su propia vista previa.
 *
 * Cuándo se bloquea (E2.0c), con cualquiera de dos señales que un sitio ajeno no
 * puede falsificar:
 *  1. El NAVEGADOR dice que el padre es el ERP (lib/designerFrame:
 *     ancestorOrigins, o el referrer del documento inicial y su marca). Bloquea
 *     desde el arranque, aunque el handshake falle, tarde o nunca llegue.
 *  2. El canal quedó en 'preview': el ERP (origen exacto) le habló a este documento.
 * Ni estar enmarcada ni `?pc_preview=1` bastan: un cliente que llega con un link
 * que trae `pc_preview=1` (sin marco, o enmarcado por otro sitio) compra como
 * siempre.
 *
 * Señal desconocida (navegador sin ancestorOrigins y sin referrer, por ejemplo
 * un marco con referrerpolicy=no-referrer): se espera el handshake (2,5 s como
 * máximo) y se decide con él. Para ese caso el ERP además no deja usar la vista
 * previa hasta que la tienda confirma que está protegida (StoreEditorPreview).
 *
 * Bloquear acá es fallar hacia lo seguro para el comercio, no autorizar: esto
 * evita acciones accidentales en la vista previa; no es un control contra
 * alguien que llame al servidor por su cuenta (eso lo siguen cubriendo las RPC).
 */
import { useEffect, useState } from 'react';
import { getPreviewChannel, type PreviewState } from './previewChannel';
import { isDesignerFrame } from './designerFrame';

export type PreviewAction = 'pedido' | 'pago' | 'newsletter' | 'probador' | 'resena';

export const PREVIEW_BLOCKED_MESSAGES: Record<PreviewAction, string> = {
  pedido:
    'Estás en la vista previa del diseñador: acá no se crean pedidos. Para hacer una compra de prueba, abrí tu tienda en otra pestaña.',
  pago:
    'Estás en la vista previa del diseñador: acá no se inician pagos. Para probar un cobro, abrí tu tienda en otra pestaña.',
  newsletter: 'Vista previa del diseñador: no se suscribe a nadie ni se mandan mails.',
  probador: 'Vista previa del diseñador: el probador no genera imágenes ni consume créditos.',
  resena: 'Vista previa del diseñador: las opiniones no se envían.',
};

export class PreviewBlockedError extends Error {
  readonly code = 'preview_blocked';
  readonly action: PreviewAction;
  constructor(action: PreviewAction) {
    super(PREVIEW_BLOCKED_MESSAGES[action]);
    this.name = 'PreviewBlockedError';
    this.action = action;
  }
}

/** Estado definitivo de esta pestaña (espera el handshake si está pendiente). */
export function settledPreviewState(): Promise<PreviewState> {
  const ch = getPreviewChannel();
  return ch ? ch.settled() : Promise.resolve('public');
}

/** ¿Esta pestaña es la vista previa del diseñador? (enmarcada por el ERP o acreditada por el canal) */
export async function isConfirmedPreview(): Promise<boolean> {
  if (isDesignerFrame()) return true; // sin esperar: no depende del handshake
  return (await settledPreviewState()) === 'preview';
}

/** Corta la operación si es la vista previa del diseñador. Llamar ANTES de cualquier request. */
export async function assertRealVisit(action: PreviewAction): Promise<void> {
  if (await isConfirmedPreview()) throw new PreviewBlockedError(action);
}

/** Para la interfaz (avisos): ¿las operaciones reales están desactivadas en esta pestaña? */
export function usePreviewProtected(): boolean {
  const state = usePreviewState();
  return isDesignerFrame() || state === 'preview';
}

/** Estado del canal para la interfaz. En una visita pública es siempre 'public'. */
export function usePreviewState(): PreviewState {
  const ch = getPreviewChannel();
  const [state, setState] = useState<PreviewState>(ch ? ch.state : 'public');
  useEffect(() => {
    if (!ch) return;
    setState(ch.state);
    const off = ch.subscribe(setState);
    return () => {
      off();
    };
  }, [ch]);
  return state;
}
