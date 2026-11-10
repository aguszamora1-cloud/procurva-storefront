/**
 * EDITOR E2.0b · protección de operaciones reales dentro de la vista previa.
 *
 * Dentro del diseñador del ERP la tienda es la REAL: sin esto, el comercio podía
 * crear un pedido (y una venta), iniciar un cobro, suscribirse al newsletter o
 * gastar créditos del probador desde su propia vista previa.
 *
 * Cuándo se bloquea: SÓLO cuando el canal de la vista previa (lib/previewChannel)
 * quedó en 'preview', o sea cuando el diseñador de procurva.app le habló a ESTE
 * documento. Ni estar enmarcada ni `?pc_preview=1` bastan: un cliente que llega
 * con un link que trae `pc_preview=1` (sin marco, o enmarcado por otro sitio)
 * compra como siempre.
 *
 * Antes del handshake: la operación ESPERA a que se resuelva (hello del ERP o
 * vencimiento del plazo, 2,5 s como máximo) y recién ahí decide. Una pestaña
 * pública desde el arranque no espera nada. Cada recarga del iframe empieza de
 * nuevo en 'pending', así que también espera.
 *
 * Bloquear acá es fallar hacia lo seguro para el comercio, no autorizar: esto
 * evita acciones accidentales en la vista previa; no es un control contra
 * alguien que llame al servidor por su cuenta (eso lo siguen cubriendo las RPC).
 */
import { useEffect, useState } from 'react';
import { getPreviewChannel, type PreviewState } from './previewChannel';

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

/** ¿Esta pestaña es la vista previa acreditada del diseñador? */
export async function isConfirmedPreview(): Promise<boolean> {
  return (await settledPreviewState()) === 'preview';
}

/** Corta la operación si es la vista previa del diseñador. Llamar ANTES de cualquier request. */
export async function assertRealVisit(action: PreviewAction): Promise<void> {
  if (await isConfirmedPreview()) throw new PreviewBlockedError(action);
}

/** Estado actual para la interfaz (avisos). En una visita pública es siempre 'public'. */
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
