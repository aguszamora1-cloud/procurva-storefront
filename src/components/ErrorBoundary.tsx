import { Component, type ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * Captura errores de render en el árbol y muestra una pantalla amigable en vez
 * de una pantalla en blanco. "Reintentar" recarga la app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) return <ErrorScreen />;
    return this.props.children;
  }
}
