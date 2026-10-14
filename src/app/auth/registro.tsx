import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppHeader, Button, Card, Field, Screen, Segmented, styles } from '@/components/ui';
import type { Role } from '@/data/mock';
import { colors, space, type } from '@/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Registro() {
  const [role, setRole] = useState<Role>('medico');
  const [f, setF] = useState({ nombre: '', apellido: '', email: '', extra1: '', extra2: '', pass: '', pass2: '' });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.nombre.trim()) e.nombre = 'Ingresa tu nombre.';
    if (!f.apellido.trim()) e.apellido = 'Ingresa tu apellido.';
    if (!EMAIL.test(f.email.trim())) e.email = 'Ingresa un correo válido.';
    if (!f.extra1.trim()) e.extra1 = 'Este campo es obligatorio.';
    if (f.pass.length < 8) e.pass = 'Usa al menos 8 caracteres.';
    if (f.pass2 !== f.pass) e.pass2 = 'Las contraseñas no coinciden.';
    if (!terms) e.terms = 'Debes aceptar los términos para continuar.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setTimeout(() => router.replace('/auth/login?aviso=registro'), 700);
  };

  const strength = [f.pass.length >= 8, /[A-Z]/.test(f.pass), /\d/.test(f.pass), /[^A-Za-z0-9]/.test(f.pass)];
  const score = strength.filter(Boolean).length;

  return (
    <Screen header={<AppHeader title="Crear cuenta" />}>
      <View style={{ gap: 6 }}>
        <Text style={type.h1}>Crea tu cuenta profesional</Text>
        <Text style={type.bodyMuted}>Selecciona tu perfil y completa tus datos. Puedes desplazarte para ver todo el formulario.</Text>
      </View>

      <Card>
        <Text style={type.label}>Tipo de perfil</Text>
        <Segmented
          value={role}
          onChange={(r) => {
            setRole(r);
            setF((s) => ({ ...s, extra1: '', extra2: '' }));
          }}
          options={[
            { value: 'medico', label: 'Profesional', icon: 'medkit-outline' },
            { value: 'visitador', label: 'Visitador', icon: 'briefcase-outline' },
          ]}
        />
      </Card>

      <Card>
        <Text style={type.overline}>Datos personales</Text>
        <Field label="Nombre" value={f.nombre} onChangeText={set('nombre')} autoCapitalize="words" error={errors.nombre} />
        <Field label="Apellido" value={f.apellido} onChangeText={set('apellido')} autoCapitalize="words" error={errors.apellido} />
        <Field
          label="Correo electrónico"
          value={f.email}
          onChangeText={set('email')}
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
      </Card>

      <Card>
        <Text style={type.overline}>Información profesional</Text>
        {role === 'medico' ? (
          <>
            <Field label="Especialidad" value={f.extra1} onChangeText={set('extra1')} placeholder="Ej. Dermatología" error={errors.extra1} />
            <Field label="Institución o consultorio" value={f.extra2} onChangeText={set('extra2')} placeholder="Opcional" />
          </>
        ) : (
          <>
            <Field label="Laboratorio" value={f.extra1} onChangeText={set('extra1')} placeholder="Laboratorio al que representas" error={errors.extra1} />
            <Field label="Zona asignada" value={f.extra2} onChangeText={set('extra2')} placeholder="Ej. Guayaquil Norte (opcional)" />
          </>
        )}
      </Card>

      <Card>
        <Text style={type.overline}>Seguridad</Text>
        <Field label="Contraseña" value={f.pass} onChangeText={set('pass')} secure icon="lock-closed-outline" error={errors.pass} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                backgroundColor: i < score ? (score < 3 ? colors.warning : colors.success) : colors.border,
              }}
            />
          ))}
        </View>
        <Text style={type.caption}>Usa 8 caracteres o más, con una mayúscula, un número y un símbolo.</Text>
        <Field label="Confirmar contraseña" value={f.pass2} onChangeText={set('pass2')} secure icon="lock-closed-outline" error={errors.pass2} />
      </Card>

      <Pressable
        onPress={() => setTerms((t) => !t)}
        style={[styles.row, { alignItems: 'flex-start' }]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: terms }}
      >
        <Ionicons name={terms ? 'checkbox' : 'square-outline'} size={22} color={errors.terms ? colors.danger : colors.primary} />
        <Text style={[type.bodyMuted, { flex: 1 }]}>Acepto los términos de uso y la política de privacidad de Multi LAB.</Text>
      </Pressable>
      {errors.terms ? <Text style={[type.caption, { color: colors.danger }]}>{errors.terms}</Text> : null}

      <Button label="Crear cuenta" onPress={submit} loading={loading} />
      <View style={[styles.row, { justifyContent: 'center', marginBottom: space.lg }]}>
        <Text style={type.bodyMuted}>¿Ya tienes cuenta?</Text>
        <Pressable onPress={() => router.replace('/auth/login')} accessibilityRole="link" hitSlop={8}>
          <Text style={[type.label, { color: colors.primary }]}>Inicia sesión</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
