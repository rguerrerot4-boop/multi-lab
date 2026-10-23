import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui';
import { CORAESSENS } from '@/data/vitrina';
import { colors, font, packColors, radius, space } from '@/theme';

const C = packColors.coraessens;

/** Acceso a la vitrina 3D de CORAESSENS, con los colores de su empaque */
export function VitrinaBanner() {
  return (
    <PressableScale onPress={() => router.push('/vitrina/cor')} accessibilityLabel="Abrir la vitrina 3D de CORAESSENS">
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', minHeight: 132 }}>
        <LinearGradient colors={[C.purple, C.purpleDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, paddingRight: 120, gap: 4, minHeight: 132 }}>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 11, color: C.red }}>NUEVO · VITRINA 3D</Text>
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
