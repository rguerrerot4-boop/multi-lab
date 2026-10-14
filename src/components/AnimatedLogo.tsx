import type { ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { BOTTOM, DOT, LAB, LEFT, MULTI, PLAY, RIGHT, TOP, TRI } from './logoPaths';

// Área del logotipo completo dentro del sistema de coordenadas del manual
export const VB = { x: 36, y: 82, w: 438, h: 118 };

// Cajas (x, y, ancho, alto) de cada pieza, medidas sobre los vectores originales
export const BOX = {
  left: [38, 114, 58, 48],
  right: [78, 114, 72, 47],
  top: [75, 84, 43, 62],
  bottom: [76, 128, 42, 64],
  play: [68, 116, 46, 57],
  tri: [82, 126, 22, 27],
  dot: [455, 139, 17, 17],
  multi: [160, 137, 217, 63],
  lab: [386, 162, 79, 35],
} as const;

export const MARK_CENTER = { x: 93.7, y: 138 };
export const PLAY_CENTER = { x: 90.9, y: 144.3 };

type Piece = { d: string; fill: string; opacity: number; tx: number; ty: number };

function piecePaths(p: Piece) {
  return (
    <G transform={`translate(${p.tx} ${p.ty})`}>
      <Path d={p.d} fill={p.fill} fillOpacity={p.opacity} />
    </G>
  );
}

function glyphPaths(g: { fill: string; glyphs: { d: string; x: number; y: number }[] }) {
  return g.glyphs.map((gl, i) => <Path key={i} d={gl.d} fill={g.fill} transform={`translate(${gl.x} ${gl.y})`} />);
}

export const PIECES: Record<keyof typeof BOX, () => ReactNode> = {
  left: () => piecePaths(LEFT),
  right: () => piecePaths(RIGHT),
  top: () => piecePaths(TOP),
  bottom: () => piecePaths(BOTTOM),
  play: () => piecePaths(PLAY),
  tri: () => piecePaths(TRI),
  dot: () => piecePaths(DOT),
  multi: () => glyphPaths(MULTI),
  lab: () => glyphPaths(LAB),
};

/** Una pieza del logo dibujada en su propia capa, en su posición exacta dentro del logo completo */
export function LogoLayer({
  name,
  scale,
  style,
}: {
  name: keyof typeof BOX;
  scale: number;
  style?: StyleProp<ViewStyle> | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}) {
  const [x, y, w, h] = BOX[name];
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: (x - VB.x) * scale, top: (y - VB.y) * scale, width: w * scale, height: h * scale }, style]}
    >
      <Svg width="100%" height="100%" viewBox={`${x} ${y} ${w} ${h}`}>
        {PIECES[name]()}
      </Svg>
    </Animated.View>
  );
}

/** Logotipo completo estático en vectores */
export function VectorLogo({ width, mark = false }: { width: number; mark?: boolean }) {
  const vb = mark ? { x: 38, y: 84, w: 112, h: 108 } : VB;
  return (
    <View style={{ width, height: (width * vb.h) / vb.w }} accessibilityRole="image" accessibilityLabel="Multi LAB">
      <Svg width="100%" height="100%" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
        {(['left', 'right', 'top', 'bottom', 'play', 'tri'] as const).map((k) => (
          <G key={k}>{PIECES[k]()}</G>
        ))}
        {!mark ? (
          <>
            {PIECES.multi()}
            {PIECES.lab()}
            {PIECES.dot()}
          </>
        ) : null}
      </Svg>
    </View>
  );
}
