import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/modals.css';
import { captureAttribution } from './lib/attribution';

// Antes del router: la URL de aterrizaje (utm_*, fbclid...) se pierde en el primer
// click de la SPA. La guardamos ya para atribuir el pedido a la campaña que lo trajo.
captureAttribution();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
