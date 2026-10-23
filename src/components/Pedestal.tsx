import { Defs, Ellipse, G, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * Pedestal cilíndrico dibujado dentro del SVG de la caja 3D, con la tapa en el mismo plano que la base
 * de la caja (misma inclinación de cámara), para que la caja quede apoyada y no flotando.
 * cx/top: centro de la tapa · rx/ry: radios de la tapa · height: alto del cilindro.
 */
export function PedestalShape({ cx, top, rx, ry, height, id }: { cx: number; top: number; rx: number; ry: number; height: number; id: string }) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.borderStrong} />
          <Stop offset="0.38" stopColor={colors.white} />
          <Stop offset="0.7" stopColor={colors.bg} />
          <Stop offset="1" stopColor={colors.border} />
        </LinearGradient>
        <LinearGradient id={`${id}-top`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} />
          <Stop offset="1" stopColor={colors.white} />
        </LinearGradient>
        <RadialGradient id={`${id}-contact`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={colors.petroleo} stopOpacity={0.32} />
          <Stop offset="0.7" stopColor={colors.petroleo} stopOpacity={0.1} />
          <Stop offset="1" stopColor={colors.petroleo} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-floor`} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={colors.petroleo} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.petroleo} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* sombra en el piso */}
      <Ellipse cx={cx} cy={top + height + ry * 0.6} rx={rx * 1.25} ry={ry * 1.1} fill={`url(#${id}-floor)`} />
      {/* cuerpo */}
      <Rect x={cx - rx} y={top} width={rx * 2} height={height} fill={`url(#${id}-side)`} />
      <Ellipse cx={cx} cy={top + height} rx={rx} ry={ry} fill={`url(#${id}-side)`} />
      {/* tapa */}
      <Ellipse cx={cx} cy={top} rx={rx} ry={ry} fill={`url(#${id}-top)`} stroke={colors.border} strokeWidth={1} />
      {/* sombra de contacto de la caja */}
      <Ellipse cx={cx} cy={top} rx={rx * 0.72} ry={ry * 0.72} fill={`url(#${id}-contact)`} />
    </G>
  );
}
