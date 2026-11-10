import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/modals.css';
import { captureAttribution } from './lib/attribution';
import { isPreviewMode } from './lib/previewMode';
import { initPreviewChannel, parentOrigins } from './lib/previewChannel';
import { initDesignerFrame } from './lib/designerFrame';

// Antes del router: la URL de aterrizaje (utm_*, fbclid...) se pierde en el primer
// click de la SPA. La guardamos ya para atribuir el pedido a la campaña que lo trajo.
captureAttribution();

// EDITOR E2.0a: canal con el diseñador del ERP. Sólo se arma si la tienda está
// ENMARCADA y vino con la marca de vista previa; una visita normal no agrega
// listeners ni manda mensajes. La marca no autoriza nada (ver lib/previewChannel).
initPreviewChannel(window.parent !== window && isPreviewMode());
// EDITOR E2.0c: quién enmarca la tienda, según el navegador (no según la URL).
// Si es el ERP, las operaciones reales quedan bloqueadas aunque el canal falle.
initDesignerFrame(parentOrigins());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
