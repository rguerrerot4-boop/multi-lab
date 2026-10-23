import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Line, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';
import { Product3D } from '@/components/Product3D';
import { Button, goBack } from '@/components/ui';
import { productById, productNote, type IconName } from '@/data/mock';
import { AR_CARDS_PDF, AR_SIZE_CM, arCardUrl, arDevice, openAR, type ArResult } from '@/lib/ar';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space } from '@/theme';

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'scan-outline', title: 'Busca una superficie plana', text: 'Apunta la cámara a una mesa, escritorio o el piso y mueve el teléfono despacio.' },
  { icon: 'hand-left-outline', title: 'Toca para colocar', text: 'Cuando aparezca la base, toca la pantalla y el producto se apoya sobre la superficie.' },
  { icon: 'resize-outline', title: 'Muévelo y gíralo', text: 'Arrastra para moverlo, pellizca para cambiar el tamaño y gira con dos dedos.' },
];

// Pantalla previa a la realidad aumentada: explica el uso y abre el visor AR del teléfono
export default function ArScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = productById(id);
  const { logEvent } = useMine();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ArResult | null>(null);
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(scan, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [scan]);

  if (!p) return null;
  const stageW = Math.min(width - space.lg * 2, 480);
  const stageH = 300;
  // en la computadora no hay cámara para la AR: solo vista previa
  const device = arDevice();

  const launch = async () => {
    setBusy(true);
    logEvent('ar_abierto', p.id);
    const r = await openAR(p);
    setResult(r);
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.petroleo }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.lg, gap: space.lg }}>
        {/* cabecera */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable
            onPress={() => goBack(`/producto/${p.id}`)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={8}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.white }}>Realidad aumentada</Text>
            <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#A9C2C8' }} numberOfLines={1}>
              {p.name} · {productNote(p).toLowerCase()}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.turquesa, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Ionicons name="scan" size={12} color={colors.petroleo} />
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: colors.petroleo }}>AR</Text>
          </View>
        </View>

        {/* escena ilustrativa: el producto sobre una superficie detectada */}
        <View style={{ width: stageW, height: stageH, alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#2A4249' }}>
          <Svg width={stageW} height={stageH} style={{ position: 'absolute' }}>
            <Defs>
              <SvgGradient id="floor" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#3B5A61" />
                <Stop offset="1" stopColor="#4E6F76" />
              </SvgGradient>
            </Defs>
            <Rect x={0} y={stageH * 0.58} width={stageW} height={stageH * 0.42} fill="url(#floor)" />
            {/* rejilla en perspectiva de la superficie detectada */}
            {Array.from({ length: 9 }, (_, i) => {
              const t = i / 8;
              const xTop = stageW * (0.28 + t * 0.44);
              const xBot = stageW * (-0.25 + t * 1.5);
              return <Line key={`v${i}`} x1={xTop} y1={stageH * 0.62} x2={xBot} y2={stageH} stroke={colors.turquesa} strokeOpacity={0.35} strokeWidth={1} />;
            })}
            {[0.62, 0.66, 0.72, 0.8, 0.9].map((y, i) => (
              <Line key={`h${i}`} x1={0} y1={stageH * y} x2={stageW} y2={stageH * y} stroke={colors.turquesa} strokeOpacity={0.25 + i * 0.05} strokeWidth={1} />
            ))}
            <Ellipse cx={stageW / 2} cy={stageH * 0.8} rx={stageW * 0.2} ry={stageH * 0.045} fill="#000" fillOpacity={0.25} />
          </Svg>
          {/* anillo de colocación */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: stageW / 2 - 90,
              top: stageH * 0.8 - 22,
              width: 180,
              height: 44,
              borderRadius: 90,
              borderWidth: 2,
              borderColor: colors.turquesa,
              opacity: scan.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.9, 0.25] }),
              transform: [{ scale: scan.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
            }}
          />
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: stageH * 0.1 }}>
            <Product3D product={p} width={stageW} height={stageH * 0.9} autoRotate interactive={false} zoom={0.95} />
          </View>
          {/* esquinas de cámara */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <View
              key={c}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 22,
                height: 22,
                borderColor: colors.white,
                opacity: 0.8,
                ...(c[0] === 't' ? { top: 12, borderTopWidth: 2 } : { bottom: 12, borderBottomWidth: 2 }),
                ...(c[1] === 'l' ? { left: 12, borderLeftWidth: 2 } : { right: 12, borderRightWidth: 2 }),
              }}
            />
          ))}
          <View style={{ position: 'absolute', top: 14, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 11, color: colors.white }}>Vista previa · así se verá en tu espacio</Text>
          </View>
        </View>

        {/* medidas */}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Measure icon="resize-outline" label="Tamaño real" value={`${(p.sizeCm ?? AR_SIZE_CM).w} × ${(p.sizeCm ?? AR_SIZE_CM).h} × ${(p.sizeCm ?? AR_SIZE_CM).d} cm`.replace(/\./g, ',')} />
          <Measure icon="phone-portrait-outline" label="Funciona en" value="Android y iPhone" />
        </View>

        {/* pasos */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, color: '#A9C2C8' }}>CÓMO USARLO</Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={s.icon} size={18} color={colors.white} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: font.semibold, fontSize: 14, color: colors.white }}>
                  {i + 1}. {s.title}
                </Text>
                <Text style={{ fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: '#C7D9DD' }}>{s.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {result === 'no-compatible' ? (
          <Notice
            icon="alert-circle-outline"
            text={
              device === 'android'
                ? 'No se pudo abrir la AR. Instala o actualiza “Servicios de Google Play para RA” (ARCore) y la app de Google desde Play Store.'
                : 'No se pudo abrir la AR. Se necesita un iPhone o iPad con iOS 12 o superior y Safari.'
            }
          />
        ) : null}
        {result === 'abierto' ? <Notice icon="checkmark-circle-outline" text="Se abrió el visor de AR de tu teléfono. Al cerrarlo vuelves aquí." ok /> : null}
        {!device ? (
          <Notice icon="information-circle-outline" text={`El visor de AR del sistema necesita el celular: abre Multi LAB en tu teléfono.${p.real ? '' : ' Con la tarjeta impresa también puedes probarla aquí con la cámara de la computadora.'}`} />
        ) : null}

        <View style={{ gap: space.sm }}>
          <Button label={busy ? 'Abriendo…' : 'Abrir en AR'} icon="scan-outline" loading={busy} disabled={!device} onPress={launch} />
          {p.real ? null : (
          <Pressable
            onPress={() => {
              logEvent('ar_tarjeta', p.id);
              Linking.openURL(arCardUrl(p.id)).catch(() => {});
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="card-outline" size={18} color={colors.white} />
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>Usar tarjeta impresa</Text>
          </Pressable>
          )}
          <Pressable
            onPress={() => router.replace(`/visor/${p.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => ({ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="cube-outline" size={18} color={colors.white} />
            <Text style={{ fontFamily: font.semibold, fontSize: 15, color: colors.white }}>Ver en 3D · 360°</Text>
          </Pressable>
          <Text style={{ fontFamily: font.medium, fontSize: 11, lineHeight: 16, color: '#8FA7AD', textAlign: 'center' }}>
            {p.real
              ? 'Modelo hecho con las fotos del empaque (tamaño aproximado). Se descarga la primera vez (unos 450 KB) y necesita internet.'
              : 'Modelo ilustrativo de un producto ficticio. Se descarga la primera vez (unos 150 KB) y necesita internet.'}
          </Text>
          <Pressable onPress={() => Linking.openURL(AR_CARDS_PDF).catch(() => {})} accessibilityRole="link" hitSlop={6} style={{ alignSelf: 'center' }}>
            <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white, textDecorationLine: 'underline' }}>Descargar tarjetas para imprimir (PDF)</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Measure({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.lg, padding: space.md, gap: 2 }}>
      <Ionicons name={icon} size={18} color={colors.turquesa} />
      <Text style={{ fontFamily: font.medium, fontSize: 11, color: '#A9C2C8' }}>{label}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: colors.white }}>{value}</Text>
    </View>
  );
}

function Notice({ icon, text, ok }: { icon: IconName; text: string; ok?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', backgroundColor: ok ? colors.successSoft : colors.warningSoft, borderRadius: radius.md, padding: space.md }}>
      <Ionicons name={icon} size={18} color={ok ? colors.success : colors.warning} />
      <Text style={{ flex: 1, fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: ok ? colors.success : colors.warning }}>{text}</Text>
    </View>
  );
}
