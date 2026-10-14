import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Avatar, BrandHeader, Button, Card, DemoNotice, ListItem, Screen, SectionHeader, styles } from '@/components/ui';
import { personById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, space, type } from '@/theme';

export default function Perfil() {
  const { userId, role, unreadNotices, logout, myRequests, myChats } = useMine();
  const me = personById(userId ?? 'm1');
  const [prefs, setPrefs] = useState({ mensajes: true, solicitudes: true, visitas: true, novedades: false });

  const toggles: { key: keyof typeof prefs; label: string }[] = [
    { key: 'mensajes', label: 'Nuevos mensajes' },
    { key: 'solicitudes', label: 'Cambios en solicitudes' },
    { key: 'visitas', label: 'Recordatorios de visitas' },
    { key: 'novedades', label: 'Novedades del catálogo' },
  ];

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <Card style={{ alignItems: 'center' }}>
        <Avatar initials={me.initials} size={80} tone={role === 'medico' ? 'dark' : 'teal'} />
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={type.h2}>{me.name}</Text>
          <Text style={type.bodyMuted}>{me.title}</Text>
          <Text style={type.caption}>{me.org}</Text>
        </View>
        <View style={[styles.row, { gap: space.xl, marginTop: space.sm }]}>
          <Stat n={myRequests.length} label="Solicitudes" />
          <Stat n={myChats.length} label="Conversaciones" />
          <Stat n={role === 'medico' ? 'Salud' : 'Visitador'} label="Perfil" />
        </View>
      </Card>

      <SectionHeader title="Información" />
      <View style={{ gap: space.sm }}>
        <ListItem icon="mail-outline" title={me.email} subtitle="Correo electrónico" />
        <ListItem icon="call-outline" title={me.phone} subtitle="Teléfono (ficticio)" />
        <ListItem icon="location-outline" title={me.city} subtitle={role === 'visitador' ? 'Zona de trabajo' : 'Ciudad del consultorio'} />
      </View>

      <SectionHeader title="Notificaciones" />
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {toggles.map((t, i) => (
          <View
            key={t.key}
            style={[styles.row, { justifyContent: 'space-between', paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }]}
          >
            <Text style={type.body}>{t.label}</Text>
            <Switch
              value={prefs[t.key]}
              onValueChange={(v) => setPrefs((p) => ({ ...p, [t.key]: v }))}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.white}
              accessibilityLabel={t.label}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title="Cuenta" />
      <View style={{ gap: space.sm }}>
        <ListItem icon="key-outline" title="Cambiar contraseña" onPress={() => router.push('/auth/recuperar')} />
        <ListItem icon="analytics-outline" title="Métricas de la prueba" subtitle="Eventos registrados en esta sesión" onPress={() => router.push('/metricas')} />
        <ListItem icon="information-circle-outline" title="Acerca de Multi LAB" subtitle="Prototipo académico de titulación" onPress={() => router.push('/acerca')} />
      </View>

      <DemoNotice text="Los datos de este perfil son de demostración." />
      <Button
        label="Cerrar sesión"
        variant="danger"
        icon="log-out-outline"
        onPress={() => {
          logout();
          router.replace('/auth/login');
        }}
      />
    </Screen>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={[type.h3, { color: colors.primary }]}>{n}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}
