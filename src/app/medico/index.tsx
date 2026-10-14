import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { MyStatusCard, NeedCard, NeedSheet } from '@/components/doctor';
import { Avatar, BrandHeader, Button, Card, ListItem, PressableScale, Screen, SectionHeader, StatusPill, styles } from '@/components/ui';
import { dayLabel, personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Dashboard del profesional de la salud
export default function MedicoInicio() {
  const { userId, unreadNotices, unreadMessages, myRequests, myVisits, chatWith, needs, returns } = useMine();
  const [needOpen, setNeedOpen] = useState(false);
  const openReturns = returns.filter((r) => r.doctorId === (userId ?? 'm1') && r.status !== 'Resuelta' && r.status !== 'Cancelada').length;
  const myNeeds = needs.filter((n) => n.doctorId === (userId ?? 'm1'));
  const me = personById(userId ?? 'm1');
  const active = myRequests.filter((r) => r.status !== 'Atendida' && r.status !== 'Cancelada');
  const next = myVisits.filter((v) => v.dayOffset >= 0 && v.status !== 'Realizada').sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const rep = personById('v1');
  const today = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <View style={{ gap: 2 }}>
        <Text style={[type.caption, { textTransform: 'capitalize' }]}>{today}</Text>
        <Text style={type.h1}>Hola, {me.name.split(' ').slice(0, 2).join(' ')}</Text>
        <Text style={type.bodyMuted}>
          {me.title} · {me.org}
        </Text>
      </View>

      <MyStatusCard />

      <PressableScale
        onPress={() => setNeedOpen(true)}
        accessibilityLabel="Necesito un producto"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.primary, borderRadius: radius.lg, padding: space.lg }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="search" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.h3, { color: colors.white }]}>Necesito un producto</Text>
          <Text style={[type.caption, { color: '#DDF1F4' }]}>Publica una solicitud con palabras clave</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </PressableScale>

      {myNeeds.length ? (
        <>
          <SectionHeader title="Mis búsquedas de producto" />
          <View style={{ gap: space.sm }}>
            {myNeeds.slice(0, 3).map((n) => (
              <NeedCard key={n.id} need={n} />
            ))}
          </View>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Kpi n={active.length} label="Solicitudes activas" icon="document-text-outline" onPress={() => router.push('/medico/solicitudes')} />
        <Kpi n={unreadMessages} label="Mensajes nuevos" icon="chatbubbles-outline" onPress={() => router.push('/medico/mensajes')} />
        <Kpi n={next ? 1 : 0} label="Visita próxima" icon="calendar-outline" onPress={() => next && router.push(`/visita/${next.id}`)} />
      </View>

      {next ? (
        <View style={{ backgroundColor: colors.ink, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={[type.overline, { color: colors.turquesa }]}>Próxima visita</Text>
            <Text style={[type.label, { color: colors.white }]}>
              {dayLabel(next.dayOffset)} · {next.time}
            </Text>
          </View>
          <View style={styles.row}>
            <Avatar initials={rep.initials} />
            <View style={{ flex: 1 }}>
              <Text style={[type.h3, { color: colors.white }]}>{rep.name}</Text>
              <Text style={[type.caption, { color: '#B9CCD0' }]}>{rep.org}</Text>
            </View>
          </View>
          <Text style={[type.bodyMuted, { color: '#D5E2E5' }]}>
            Productos a presentar: {next.productIds.map((id) => productById(id)?.name).join(', ')}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Ver detalle" small onPress={() => router.push(`/visita/${next.id}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Escribir" small variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith(rep.id)}`)} />
            </View>
          </View>
        </View>
      ) : null}

      <SectionHeader title="Accesos rápidos" />
      <View style={{ gap: space.sm }}>
        <ListItem icon="add-circle-outline" title="Nueva solicitud" subtitle="Información o material de apoyo" onPress={() => router.push('/solicitud/nueva')} />
        <ListItem
          icon="arrow-undo-outline"
          title="Devoluciones"
          subtitle={openReturns ? `${openReturns} en curso · Reportar material en mal estado` : 'Reportar material que llegó en mal estado'}
          onPress={() => router.push('/devoluciones')}
        />
        <ListItem icon="time-outline" title="Historial de visitas" subtitle="Visitas recibidas y próximas" onPress={() => router.push('/historial')} />
      </View>

      <SectionHeader title="Solicitudes recientes" action="Ver todas" onAction={() => router.push('/medico/solicitudes')} />
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {myRequests.slice(0, 3).map((r, i) => (
          <PressableScale key={r.id} onPress={() => router.push(`/solicitud/${r.id}`)}>
            <View style={[styles.row, { paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={type.label}>{productById(r.productId)?.name}</Text>
                <Text style={type.caption}>
                  {r.code} · {r.type}
                </Text>
              </View>
              <StatusPill status={r.status} />
            </View>
          </PressableScale>
        ))}
      </Card>
      <NeedSheet visible={needOpen} onClose={() => setNeedOpen(false)} />
    </Screen>
  );
}

function Kpi({ n, label, icon, onPress }: { n: number; label: string; icon: 'document-text-outline' | 'chatbubbles-outline' | 'calendar-outline'; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 }}
      accessibilityLabel={`${n} ${label}`}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[type.h2, { fontSize: 22 }]}>{n}</Text>
      <Text style={type.caption} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}
