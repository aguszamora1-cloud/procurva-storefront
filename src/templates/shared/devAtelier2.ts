/**
 * Atelier 2 · A0: interruptor SÓLO de desarrollo para ver Atelier 2 dentro de la
 * vista previa de Atelier.
 *
 *   ?pc_dev_tpl=atelier&pc_dev_atelier=2   Atelier 2 (queda en la pestaña)
 *   ?pc_dev_atelier=1  o  =off              vuelve a Atelier 1
 *
 * - Sólo vale con `import.meta.env.DEV`: en el build de producción es `false`
 *   literal y el valor queda fijo en `false` (la lectura desaparece).
 * - Sólo vale sobre la vista previa de desarrollo de Atelier (`devTemplate ===
 *   'atelier'`). Esa vista previa es la que instala la guarda de escrituras en
 *   lib/devTemplate al cargarse; este módulo la importa, así que la guarda queda
 *   puesta antes de leer el interruptor. El interruptor no abre ninguna escritura.
 * - No lee ni escribe la configuración de la tienda: vive en la sessionStorage
 *   de la pestaña. No cambia qué plantilla tiene aplicada ninguna tienda.
 */

import { devTemplate } from '@/lib/devTemplate';

const PARAM = 'pc_dev_atelier';
const STORAGE_KEY = 'pc_dev_atelier';

function readDevAtelier2(): boolean {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl === '2') {
      sessionStorage.setItem(STORAGE_KEY, '2');
      return true;
    }
    if (fromUrl === '1' || fromUrl === 'off') {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return sessionStorage.getItem(STORAGE_KEY) === '2';
  } catch {
    return false;
  }
}

/** true = la vista previa de desarrollo de Atelier muestra Atelier 2. Siempre false en producción. */
export const devAtelier2: boolean =
  import.meta.env.DEV && typeof window !== 'undefined' && devTemplate === 'atelier' ? readDevAtelier2() : false;
