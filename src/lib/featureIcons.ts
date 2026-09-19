import {
  Award,
  BadgeCheck,
  Clock,
  CreditCard,
  Droplet,
  Feather,
  Gift,
  Heart,
  Leaf,
  Package,
  Palette,
  RefreshCcw,
  Ruler,
  Scissors,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  ThumbsUp,
  Truck,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Íconos permitidos en el bloque "Beneficios" (section_type 'features').
 * Lista CERRADA a propósito: el contenido lo arma Claude o el comercio y acá no
 * entra ni un SVG ni una URL, solo una clave. Clave desconocida = sin ícono.
 *
 * Espejo de FEATURE_ICON_KEYS en procurva2 (components/catalog/catalogShared.tsx)
 * y de la validación del MCP (api/mcp.ts): si se agrega uno, va en los tres.
 */
export const FEATURE_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  shield: ShieldCheck,
  ruler: Ruler,
  sparkles: Sparkles,
  leaf: Leaf,
  droplet: Droplet,
  shirt: Shirt,
  heart: Heart,
  star: Star,
  refresh: RefreshCcw,
  check: BadgeCheck,
  package: Package,
  zap: Zap,
  sun: Sun,
  snowflake: Snowflake,
  wind: Wind,
  scissors: Scissors,
  gift: Gift,
  card: CreditCard,
  clock: Clock,
  award: Award,
  feather: Feather,
  thumbs_up: ThumbsUp,
  palette: Palette,
};
