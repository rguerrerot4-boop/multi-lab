import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppHeader, Button, Card, Field, Screen, Segmented, styles } from '@/components/ui';
import { DEMO_USER, personById, type Role } from '@/data/mock';
import { useApp } from '@/store/AppStore';
import { colors, space, type } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AVISOS: Record<string, { title: string; body: string }> = {
  clave: { title: 'Contraseña actualizada', body: 'Ya puedes ingresar con tu nueva contraseña.' },
  registro: { title: 'Cuenta creada', body: 'Inicia sesión para comenzar a usar Multi LAB.' },
};

// Única pantalla de inicio de sesión (los avisos se muestran con el parámetro `aviso`)
export default function Login() {
  const { aviso } = useLocalSearchParams<{ aviso?: string }>();
  const { login } = useApp();
  const [role, setRole] = useState<Role>('medico');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showAviso, setShowAviso] = useState(!!aviso && !!AVISOS[aviso]);

  const fillDemo = () => {
    setEmail(personById(DEMO_USER[role]).email);
    setPassword('demo1234');
    setErrors({});
  };

  const submit = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Ingresa tu correo electrónico.';
    else if (!EMAIL.test(email.trim())) e.email = 'El formato del correo no es válido.';
    if (!password) e.password = 'Ingresa tu contraseña.';
    else if (password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(role);
      router.replace(role === 'medico' ? '/medico' : '/visitador');
    }, 600);
  };

  return (
    <Screen header={<AppHeader onBack={() => router.replace('/')} />}>
      {showAviso && aviso ? (
        <View style={[styles.row, { backgroundColor: colors.successSoft, padding: space.md, borderRadius: 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: colors.success }]}>{AVISOS[aviso].title}</Text>
            <Text style={type.caption}>{AVISOS[aviso].body}</Text>
          </View>
          <Pressable onPress={() => setShowAviso(false)} accessibilityLabel="Cerrar aviso" hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.inkMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <Text style={type.h1}>Bienvenido de nuevo</Text>
        <Text style={type.bodyMuted}>Ingresa con tu cuenta profesional para continuar.</Text>
      </View>

      <Card>
        <Text style={type.label}>Perfil de acceso</Text>
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: 'medico', label: 'Profesional', icon: 'medkit-outline' },
            { value: 'visitador', label: 'Visitador', icon: 'briefcase-outline' },
          ]}
        />
        <Field
          label="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          placeholder="nombre@correo.com"
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="Tu contraseña"
          icon="lock-closed-outline"
          secure
          error={errors.password}
        />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Pressable
            onPress={() => setRemember((r) => !r)}
            style={styles.row}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
          >
            <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={22} color={colors.primary} />
            <Text style={type.bodyMuted}>Recordarme</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/auth/recuperar')} accessibilityRole="link" hitSlop={8}>
            <Text style={[type.label, { color: colors.primary }]}>¿Olvidaste tu contraseña?</Text>
          </Pressable>
        </View>
        <Button label="Iniciar sesión" iconRight="arrow-forward" onPress={submit} loading={loading} />
        <Button label="Completar con cuenta demo" variant="ghost" icon="flash-outline" onPress={fillDemo} small />
      </Card>

      <View style={[styles.row, { justifyContent: 'center' }]}>
        <Text style={type.bodyMuted}>¿No tienes una cuenta?</Text>
        <Pressable onPress={() => router.push('/auth/registro')} accessibilityRole="link" hitSlop={8}>
          <Text style={[type.label, { color: colors.primary }]}>Regístrate</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
