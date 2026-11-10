import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Image, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { PressableScale } from '@/components/ui';
import { PANCREOGEN } from '@/data/pancreogen';
import { arModelUrls } from '@/lib/ar';
import { CORAESSENS } from '@/data/vitrina';
import { TEARSOFT } from '@/data/tearsoft';
import { colors, font, packColors, radius, space } from '@/theme';

const C = packColors.coraessens;

/** Acceso a la ficha 3D de CORAESSENS, con los colores de su empaque */
export function VitrinaBanner() {
  return (
    <PressableScale onPress={() => router.push('/producto/cor')} accessibilityLabel="Abrir la ficha 3D de CORAESSENS">
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 132 }}>
        <LinearGradient colors={[C.purple, C.purpleDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, paddingRight: 120, gap: 4, minHeight: 132 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.red }}>NUEVO · FICHA 3D</Text>
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.white, letterSpacing: -0.3 }}>CORAESSENS®</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.white, opacity: 0.88 }}>
            Caja en 3D con las fotos del empaque, AR y su información impresa.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.white }}>Explorar</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </View>
        </LinearGradient>
        <Image
          source={CORAESSENS.thumb}
          style={{ position: 'absolute', right: 18, top: 16, width: 78, height: 113, borderRadius: 4, transform: [{ rotate: '8deg' }] }}
          accessibilityIgnoresInvertColors
        />
      </View>
    </PressableScale>
  );
}

const P = packColors.pancreogen;

/** Acceso al catálogo 3D de PANCREOGEN (frasco 360°), con los colores de su etiqueta */
export function PancreogenBanner() {
  // en la web empieza a descargar el frasco 3D apenas se ve el banner (la ficha abre más rápido)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => void import('@/lib/bottleGL').then((m) => m.preloadBottle(arModelUrls('pan').glb)).catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <PressableScale onPress={() => router.push('/producto/pan')} accessibilityLabel="Abrir el catálogo 3D de PANCREOGEN">
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 132 }}>
        <LinearGradient colors={[P.teal, P.night]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, paddingRight: 112, gap: 4, minHeight: 132 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: P.teal }}>NUEVO · CATÁLOGO 3D</Text>
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.white, letterSpacing: -0.3 }}>PANCREOGEN®</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.white, opacity: 0.88 }}>
            El frasco gira y baja contigo: se abre, muestra sus cápsulas y su etiqueta punto por punto.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.white }}>Explorar</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </View>
        </LinearGradient>
        <Image source={PANCREOGEN.thumb.real} style={{ position: 'absolute', right: 26, top: 10, width: 112 * (292 / 900), height: 112, transform: [{ rotate: '-7deg' }] }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    </PressableScale>
  );
}

const T = packColors.tearsoft;

/** Acceso al catálogo en historias de TEARSOFT, con los colores de su caja */
export function TearsoftBanner() {
  return (
    <PressableScale onPress={() => router.push('/producto/tea')} accessibilityLabel="Abrir el catálogo de TEARSOFT">
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 132 }}>
        <LinearGradient colors={[T.navy, T.navyDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, paddingRight: 112, gap: 4, minHeight: 132 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: T.navy }}>NUEVO · HISTORIA 3D</Text>
          </View>
          <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.white, letterSpacing: -0.3 }}>TEARSOFT®</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: colors.white, opacity: 0.92 }}>
            Siete páginas para pasar de lado y una caja 3D que se despliega en su troquel.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.white }}>Explorar</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </View>
        </LinearGradient>
        <Image source={TEARSOFT.thumb.real} style={{ position: 'absolute', right: 22, top: 14, width: 104 / 1.963, height: 104, borderRadius: 3, transform: [{ rotate: '7deg' }] }} accessibilityIgnoresInvertColors />
      </View>
    </PressableScale>
  );
}

/** Los productos reales con catálogo 3D, uno al lado del otro (se deslizan de lado en pantallas angostas) */
export function Destacados() {
  const { width } = useWindowDimensions();
  const w = Math.min(340, width - 72);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={w + space.md} decelerationRate="fast" contentContainerStyle={{ gap: space.md, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg }}>
      <View style={{ width: space.lg - space.md }} />
      <View style={{ width: w }}>
        <TearsoftBanner />
      </View>
      <View style={{ width: w }}>
        <PancreogenBanner />
      </View>
      <View style={{ width: w }}>
        <VitrinaBanner />
      </View>
    </ScrollView>
  );
}
