import { memo, useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { brand, colors, mascot } from '@/theme';

// «Multi»: el personaje de píxeles de Oficina Claude, vestido de médico.
// Mismo cuerpo (bloque de 14 × 11 con brazos y pies cortos, ojos de 2 × 2 y mejillas), con los colores de Multi LAB,
// bata blanca, estetoscopio y gorro con una cruz teal. Se dibuja con rectángulos en un lienzo de 22 × 24 píxeles.
const OUT = brand.petroleo; // contorno
const M = brand.teal; // cuerpo
const L = brand.turquesa; // brillo
const S = colors.primaryPressed; // sombra
const COAT = colors.white;
const COAT_S = colors.border; // sombra de la bata
const STETH = mascot.steth;
const METAL = colors.borderStrong;
const CHEEK = mascot.cheek;

// gorro: w = blanco, t = cruz teal, s = sombra
const HAT = ['....wwwwww....', '...wwwttwww...', '...wwttttww...', '...wwwttwww...', '..sssssssssss.'];
const HAT_C: Record<string, string> = { w: COAT, t: M, s: COAT_S };
const HAT_OFF = -(HAT.length - 2);

// bordes nítidos en la web (sin suavizado entre píxeles)
const CRISP = { shapeRendering: 'crispEdges' } as object;

type Px = [number, number, number, number, string, number?]; // x, y, ancho, alto, color, opacidad

export interface Pose {
  blink?: boolean;
  look?: -1 | 0 | 1;
  step?: 0 | 1 | 2;
  wave?: boolean;
  open?: boolean; // boca abierta (habla)
  happy?: boolean; // ojos sonrientes
}

function build(o: Pose): Px[] {
  const r: Px[] = [];
  const R = (x: number, y: number, w: number, h: number, c: string, a?: number) => r.push([x, y, w, h, c, a]);
  const x = 0;
  const y = 0;
  const st = o.step ?? 0;
  // pies
  R(x + 1, y + 10, 5, 4 - (st === 1 ? 1 : 0), OUT);
  R(x + 8, y + 10, 5, 4 - (st === 2 ? 1 : 0), OUT);
  R(x + 2, y + 11, 3, 2 - (st === 1 ? 1 : 0), S);
  R(x + 9, y + 11, 3, 2 - (st === 2 ? 1 : 0), S);
  // brazos (el derecho saluda); las mangas son de la bata
  const lay = y + 5;
  const ray = o.wave ? y + 1 : y + 5;
  R(x - 3, lay - 1, 4, 5, OUT);
  R(x - 2, lay, 2, 3, COAT);
  R(x - 2, lay + 2, 2, 1, M);
  R(x + 13, ray - 1, 4, o.wave ? 6 : 5, OUT);
  R(x + 14, ray, 2, o.wave ? 4 : 3, COAT);
  R(x + 14, o.wave ? ray : ray + 2, 2, 1, M);
  // contorno del cuerpo
  R(x + 1, y - 1, 12, 1, OUT);
  R(x - 1, y + 1, 1, 9, OUT);
  R(x + 14, y + 1, 1, 9, OUT);
  R(x + 1, y + 11, 12, 1, OUT);
  R(x, y, 1, 1, OUT);
  R(x + 13, y, 1, 1, OUT);
  R(x, y + 10, 1, 1, OUT);
  R(x + 13, y + 10, 1, 1, OUT);
  // cuerpo
  R(x + 1, y, 12, 11, M);
  R(x, y + 1, 14, 9, M);
  R(x + 13, y + 2, 1, 5, S);
  R(x + 2, y + 1, 4, 1, L);
  R(x + 1, y + 2, 1, 3, L);
  // bata: de la boca hacia abajo, abierta en V con la camisa teal al centro
  R(x, y + 8, 14, 2, COAT);
  R(x + 1, y + 10, 12, 1, COAT);
  R(x + 13, y + 8, 1, 2, COAT_S);
  R(x + 1, y + 10, 12, 1, COAT_S, 0.6);
  R(x + 6, y + 9, 2, 2, M); // V de la bata
  R(x + 6, y + 8, 2, 1, S);
  R(x + 10, y + 9, 2, 1, M); // bolsillo
  // estetoscopio: manguera por los lados y la campana sobre la bata
  R(x + 2, y + 7, 1, 2, STETH);
  R(x + 11, y + 7, 1, 2, STETH);
  R(x + 3, y + 9, 1, 1, STETH);
  R(x + 3, y + 10, 2, 1, METAL);
  // ojos
  const lk = o.look ?? 0;
  const ey = y + 3;
  if (o.blink) {
    R(x + 4 + lk, ey + 1, 2, 1, OUT);
    R(x + 9 + lk, ey + 1, 2, 1, OUT);
  } else if (o.happy) {
    R(x + 4 + lk, ey, 2, 1, OUT);
    R(x + 3 + lk, ey + 1, 1, 1, OUT);
    R(x + 6 + lk, ey + 1, 1, 1, OUT);
    R(x + 9 + lk, ey, 2, 1, OUT);
    R(x + 8 + lk, ey + 1, 1, 1, OUT);
    R(x + 11 + lk, ey + 1, 1, 1, OUT);
  } else {
    R(x + 4 + lk, ey, 2, 2, OUT);
    R(x + 9 + lk, ey, 2, 2, OUT);
    R(x + 4 + lk, ey, 1, 1, COAT);
    R(x + 9 + lk, ey, 1, 1, COAT);
  }
  // mejillas
  R(x + 2, y + 6, 2, 1, CHEEK, 0.7);
  R(x + 11, y + 6, 2, 1, CHEEK, 0.7);
  // boca
  if (o.open) {
    R(x + 6 + lk, y + 6, 3, 2, OUT);
    R(x + 7 + lk, y + 7, 1, 1, CHEEK);
  } else {
    R(x + 6 + lk, y + 7, 3, 1, OUT);
    R(x + 5 + lk, y + 6, 1, 1, OUT);
    R(x + 9 + lk, y + 6, 1, 1, OUT);
  }
  // gorro con su contorno
  const hy = y + HAT_OFF;
  const set = new Set<string>();
  const px: [number, number, string][] = [];
  HAT.forEach((row, j) => [...row].forEach((ch, i) => ch !== '.' && (px.push([i, j, HAT_C[ch]]), set.add(`${i},${j}`))));
  px.forEach(([i, j]) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].forEach(([dx, dy]) => {
      const k = `${i + dx},${j + dy}`;
      if (!set.has(k) && j + dy < HAT.length) {
        set.add(k);
        R(x + i + dx, hy + j + dy, 1, 1, OUT);
      }
    }),
  );
  px.forEach(([i, j, c]) => R(x + i, hy + j, 1, 1, c));
  return r;
}

/** El personaje, de `size` píxeles de ancho (lienzo de 22 × 24) */
export const Personaje = memo(function Personaje({ size = 56, blink, look = 0, step = 0, wave, open, happy }: Pose & { size?: number }) {
  const px = useMemo(() => build({ blink, look, step, wave, open, happy }), [blink, look, step, wave, open, happy]);
  return (
    <Svg width={size} height={(size * 24) / 22} viewBox="-4 -6 22 24" accessibilityElementsHidden importantForAccessibility="no">
      {px.map(([x, y, w, h, c, a], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} fill={c} opacity={a} {...CRISP} />
      ))}
    </Svg>
  );
});
