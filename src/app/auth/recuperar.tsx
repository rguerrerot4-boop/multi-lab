import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { RECOVERY_STEPS, Steps } from '@/components/Steps';
import { AppHeader, Button, Card, Field, Screen } from '@/components/ui';
import { colors, type } from '@/theme';


export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresa el correo con el que te registraste.');
      return;
    }
    setError(undefined);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: '/auth/verificar', params: { email: email.trim() } });
    }, 600);
  };

  return (
    <Screen header={<AppHeader title="Recuperar acceso" />}>
      <Steps steps={RECOVERY_STEPS} current={0} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="key-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[type.h1, { textAlign: 'center' }]}>¿Olvidaste tu contraseña?</Text>
        <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
          Te enviaremos un código de 6 dígitos para verificar que eres tú.
        </Text>
      </View>
      <Card>
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="nombre@correo.com"
          error={error}
        />
        <Button label="Enviar código" iconRight="arrow-forward" onPress={submit} loading={loading} />
      </Card>
      <Button label="Volver a iniciar sesión" variant="ghost" onPress={() => router.replace('/auth/login')} />
    </Screen>
  );
}
