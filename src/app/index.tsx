import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, logoFull } from '@/components/ui';
import { colors, space, type } from '@/theme';

// Pantalla de bienvenida
export default function Welcome() {
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(lift, { toValue: 0, useNativeDriver: true, bounciness: 8 }),
    ]).start();
  }, [fade, lift]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          <Animated.View style={{ opacity: fade, alignItems: 'center', gap: space.md, transform: [{ translateY: lift }] }}>
            <Image source={logoFull} style={{ width: 280, height: 68, marginBottom: space.md }} resizeMode="contain" accessibilityLabel="Multi LAB" />
            <Text style={[type.h2, { textAlign: 'center' }]}>Menos materiales.{'\n'}Más conexión.</Text>
            <Text style={[type.bodyMuted, { textAlign: 'center', maxWidth: 320 }]}>
              Presenta productos, comunícate y da seguimiento a cada visita médica desde un solo lugar.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={{ gap: space.md, opacity: fade }}>
          <Button label="Iniciar sesión" iconRight="arrow-forward" onPress={() => router.push('/auth/login')} />
          <Button label="Crear cuenta" variant="secondary" onPress={() => router.push('/auth/registro')} />
          <Text style={[type.caption, { textAlign: 'center', marginTop: space.sm }]}>
            Prototipo académico · Datos de demostración
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
