import { useMemo, useState } from 'react';

/**
 * Probador virtual universal (placeholder hasta integrar fashn.ai).
 *
 * Panel inline que se despliega dentro del detalle de producto (no es modal):
 * estima el talle ideal a partir de altura, peso y (opcional) talle habitual,
 * y lo mapea contra los talles realmente disponibles del producto. La
 * recomendación es orientativa.
 */

// Escala genérica unisex de adulto, de menor a mayor.
const SCALE = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const;
type ScaleSize = (typeof SCALE)[number];

// Equivalencia letra → talle numérico argentino (aprox.).
const NUMERIC: Record<ScaleSize, string> = {
  XS: '38',
  S: '40',
  M: '42',
  L: '44',
  XL: '46',
  XXL: '48',
  XXXL: '50',
};

/** Índice (0..6) en SCALE estimado por peso, ajustado por altura. */
function indexFromBody(heightCm: number, weightKg: number): number {
  let idx: number;
  if (weightKg < 52) idx = 0; // XS
  else if (weightKg < 62) idx = 1; // S
  else if (weightKg < 74) idx = 2; // M
  else if (weightKg < 87) idx = 3; // L
  else if (weightKg < 100) idx = 4; // XL
  else if (weightKg < 115) idx = 5; // XXL
  else idx = 6; // XXXL

  // Ajuste por altura: ref 170 cm. Más alto reparte el peso (talle menor),
  // más bajo lo concentra (talle mayor).
  const dev = heightCm - 170;
  if (dev >= 12) idx -= 1;
  else if (dev <= -12) idx += 1;

  return Math.max(0, Math.min(SCALE.length - 1, idx));
}

/** Normaliza un talle escrito por el usuario a un índice de SCALE, o null. */
function scaleIndexOf(raw: string): number | null {
  const up = raw.trim().toUpperCase();
  const letter = SCALE.indexOf(up as ScaleSize);
  if (letter >= 0) return letter;
  // talle numérico → buscamos el más cercano en NUMERIC
  if (/^\d+$/.test(up)) {
    const target = Number(up);
    let best = 0;
    let bestDist = Infinity;
    SCALE.forEach((s, i) => {
      const d = Math.abs(Number(NUMERIC[s]) - target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }
  return null;
}

/** Talle recomendado (letra) combinando cuerpo + talle habitual opcional. */
function recommend(heightCm: number, weightKg: number, usual: string): ScaleSize {
  const bodyIdx = indexFromBody(heightCm, weightKg);
  const usualIdx = usual ? scaleIndexOf(usual) : null;
  // Si hay talle habitual válido, promediamos (el habitual pesa fuerte).
  const idx = usualIdx === null ? bodyIdx : Math.round((bodyIdx + usualIdx) / 2);
  return SCALE[Math.max(0, Math.min(SCALE.length - 1, idx))];
}

/** Mapea la letra recomendada al talle disponible más parecido del producto. */
function matchAvailable(reco: ScaleSize, available: string[]): string | null {
  if (available.length === 0) return null;
  const norm = available.map((s) => s.trim().toUpperCase());

  // 1) coincidencia exacta por letra
  const byLetter = norm.indexOf(reco);
  if (byLetter >= 0) return available[byLetter];

  // 2) coincidencia exacta por número equivalente
  const byNumber = norm.indexOf(NUMERIC[reco]);
  if (byNumber >= 0) return available[byNumber];

  const recoIdx = SCALE.indexOf(reco);

  // 3) talles numéricos → el más cercano al equivalente numérico
  const numeric = available.filter((s) => /^\d+$/.test(s.trim()));
  if (numeric.length > 0) {
    const target = Number(NUMERIC[reco]);
    return numeric.reduce((best, s) =>
      Math.abs(Number(s) - target) < Math.abs(Number(best) - target) ? s : best,
    );
  }

  // 4) talles por letra → el más cercano en la escala
  const letters = available.filter((s) => SCALE.includes(s.trim().toUpperCase() as ScaleSize));
  if (letters.length > 0) {
    return letters.reduce((best, s) => {
      const di = Math.abs(SCALE.indexOf(s.trim().toUpperCase() as ScaleSize) - recoIdx);
      const db = Math.abs(SCALE.indexOf(best.trim().toUpperCase() as ScaleSize) - recoIdx);
      return di < db ? s : best;
    });
  }

  return null;
}

interface Props {
  /** Talles disponibles del producto (ya ordenados). */
  sizes: string[];
  /** Aplica el talle elegido al selector del producto. */
  onSelect: (size: string) => void;
}

export function SizeFinder({ sizes, onSelect }: Props) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [usual, setUsual] = useState('');
  const [reco, setReco] = useState<ScaleSize | null>(null);

  const h = Number(height);
  const w = Number(weight);
  const canCalc = h >= 120 && h <= 230 && w >= 30 && w <= 250;

  const matched = useMemo(
    () => (reco ? matchAvailable(reco, sizes) : null),
    [reco, sizes],
  );

  const calc = () => {
    if (!canCalc) return;
    setReco(recommend(h, w, usual));
  };

  return (
    <div>
      <p className="text-sm text-subtle">
        Contanos tus datos y te recomendamos el talle ideal para esta prenda.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">Altura (cm)</span>
          <input
            type="number"
            inputMode="numeric"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="170"
            className="w-full rounded-md border border-line bg-background px-3 py-2.5 text-sm text-text outline-none focus:border-text"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">Peso (kg)</span>
          <input
            type="number"
            inputMode="numeric"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="70"
            className="w-full rounded-md border border-line bg-background px-3 py-2.5 text-sm text-text outline-none focus:border-text"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">
          Talle habitual <span className="normal-case tracking-normal text-subtle">(opcional)</span>
        </span>
        <input
          type="text"
          value={usual}
          onChange={(e) => setUsual(e.target.value)}
          placeholder="Ej: M o 42"
          className="w-full rounded-md border border-line bg-background px-3 py-2.5 text-sm text-text outline-none focus:border-text"
        />
      </label>

      <button
        type="button"
        onClick={calc}
        disabled={!canCalc}
        className="mt-4 w-full rounded-[10px] bg-primary py-3 text-[14px] font-bold text-on-primary transition-all duration-200 hover:bg-accent hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary disabled:hover:text-on-primary"
      >
        Calcular mi talle
      </button>

      {reco && (
        <div className="mt-4 animate-fade-in rounded-md border border-line bg-background p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-muted">Te recomendamos</p>
          <p className="mt-1 font-heading text-4xl font-extrabold text-text">{matched ?? reco}</p>
          {matched ? (
            <>
              <p className="mt-1 text-[12px] text-subtle">Equivale a un talle {reco}</p>
              <button
                type="button"
                onClick={() => onSelect(matched)}
                className="mt-4 w-full rounded-[10px] border-2 border-text bg-background py-2.5 text-[13px] font-bold text-text transition-colors hover:bg-text hover:text-background"
              >
                Usar talle {matched}
              </button>
            </>
          ) : (
            <p className="mt-1 text-[12px] text-subtle">Este talle no está disponible para esta prenda.</p>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-[11px] leading-relaxed text-subtle">
        La recomendación es orientativa. Ante la duda, te sugerimos consultar la guía de talles.
      </p>
    </div>
  );
}
