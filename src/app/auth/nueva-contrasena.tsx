import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { RECOVERY_STEPS, Steps } from '@/components/Steps';
import { AppHeader, Button, Card, Field, Screen, styles } from '@/components/ui';
import { colors, type } from '@/theme';

export default function NuevaContrasena() {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [errors, setErrors] = useState<{ pass?: string; pass2?: string }>({});

  const rules = [
    { ok: pass.length >= 8, label: '8 caracteres o más' },
    { ok: /[A-Z]/.test(pass), label: 'Una mayúscula' },
    { ok: /\d/.test(pass), label: 'Un número' },
    { ok: /[^A-Za-z0-9]/.test(pass), label: 'Un símbolo' },
  ];

  const save = () => {
    const e: typeof errors = {};
    if (!rules.every((r) => r.ok)) e.pass = 'La contraseña no cumple todos los requisitos.';
    if (pass2 !== pass) e.pass2 = 'Las contraseñas no coinciden.';
    setErrors(e);
    if (!Object.keys(e).length) router.replace('/auth/listo');
  };

  return (
    <Screen header={<AppHeader title="Nueva contraseña" onBack={() => router.replace('/auth/login')} />}>
      <Steps steps={RECOVERY_STEPS} current={2} />
      <View style={{ gap: 6 }}>
        <Text style={type.h1}>Crea una nueva contraseña</Text>
        <Text style={type.bodyMuted}>Debe ser diferente a la que usabas antes.</Text>
      </View>
      <Card>
        <Field label="Nueva contraseña" value={pass} onChangeText={setPass} secure icon="lock-closed-outline" error={errors.pass} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {rules.map((r) => (
            <View key={r.label} style={[styles.row, { width: '46%', gap: 6 }]}>
              <Ionicons name={r.ok ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={r.ok ? colors.success : colors.inkSubtle} />
              <Text style={[type.caption, { color: r.ok ? colors.success : colors.inkMuted }]}>{r.label}</Text>
            </View>
          ))}
        </View>
        <Field label="Confirmar contraseña" value={pass2} onChangeText={setPass2} secure icon="lock-closed-outline" error={errors.pass2} />
        <Button label="Guardar contraseña" onPress={save} />
      </Card>
    </Screen>
  );
}
