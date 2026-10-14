import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { RECOVERY_STEPS, Steps } from '@/components/Steps';
import { AppHeader, Button, Card, DemoNotice, Screen, styles } from '@/components/ui';
import { colors, font, radius, type } from '@/theme';

const DEMO_CODE = '123456';

export default function Verificar() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [seconds, setSeconds] = useState(60);
  const [resent, setResent] = useState(false);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = () => {
    if (code.length < 6) return setError('Ingresa los 6 dígitos del código.');
    if (code !== DEMO_CODE) {
      setCode('');
      return setError('El código no es correcto. Revisa tu correo e inténtalo de nuevo.');
    }
    setError(undefined);
    router.replace('/auth/nueva-contrasena');
  };

  return (
    <Screen header={<AppHeader title="Verificación" />}>
      <Steps steps={RECOVERY_STEPS} current={1} />
      <View style={{ gap: 6 }}>
        <Text style={type.h1}>Revisa tu correo</Text>
        <Text style={type.bodyMuted}>
          Enviamos un código de 6 dígitos a <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{email || 'tu correo'}</Text>.
        </Text>
      </View>

      <Card>
        <Pressable onPress={() => input.current?.focus()} style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel="Campo de código de verificación">
          {Array.from({ length: 6 }).map((_, i) => {
            const active = i === code.length;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 56,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: error ? colors.danger : active ? colors.primary : colors.border,
                  backgroundColor: code[i] ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 22, color: colors.ink }}>{code[i] ?? ''}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setError(undefined);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
          accessibilityLabel="Código de verificación"
        />
        {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
        <View style={[styles.row, { justifyContent: 'center' }]}>
          {seconds > 0 ? (
            <Text style={type.bodyMuted}>Reenviar código en 0:{String(seconds).padStart(2, '0')}</Text>
          ) : (
            <Pressable
              onPress={() => {
                setSeconds(60);
                setResent(true);
              }}
              accessibilityRole="button"
            >
              <Text style={[type.label, { color: colors.primary }]}>Reenviar código</Text>
            </Pressable>
          )}
        </View>
        {resent ? <Text style={[type.caption, { textAlign: 'center', color: colors.success }]}>Te enviamos un nuevo código.</Text> : null}
        <Button label="Verificar" onPress={verify} disabled={code.length < 6} />
      </Card>
      <DemoNotice text={`Demostración: el código válido es ${DEMO_CODE}`} />
      <Button label="Cambiar correo" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
