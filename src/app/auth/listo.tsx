import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { RECOVERY_STEPS, Steps } from '@/components/Steps';
import { Button, Screen } from '@/components/ui';
import { colors, space, type } from '@/theme';

export default function Listo() {
  const pop = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, bounciness: 14, useNativeDriver: true }).start();
  }, [pop]);

  return (
    <Screen contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <Steps steps={RECOVERY_STEPS} current={3} />
      <View style={{ alignItems: 'center', gap: space.md, marginVertical: space.xl }}>
        <Animated.View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.successSoft,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pop }],
          }}
        >
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        </Animated.View>
        <Text style={[type.h1, { textAlign: 'center' }]}>¡Contraseña actualizada!</Text>
        <Text style={[type.bodyMuted, { textAlign: 'center' }]}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
      </View>
      <Button label="Ir a iniciar sesión" iconRight="arrow-forward" onPress={() => router.replace('/auth/login?aviso=clave')} />
    </Screen>
  );
}
