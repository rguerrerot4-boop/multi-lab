import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { Avatar, BrandHeader, Button, Card, ListItem, PressableScale, Screen, SectionHeader, StatusPill, styles } from '@/components/ui';
import { dayLabel, personById, productById, products } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Dashboard del profesional de la salud
export default function MedicoInicio() {
  const { userId, unreadNotices, unreadMessages, myRequests, myVisits, chatWith } = useMine();
  const me = personById(userId ?? 'm1');
  const active = myRequests.filter((r) => r.status !== 'Atendida' && r.status !== 'Cancelada');
  const next = myVisits.filter((v) => v.dayOffset >= 0 && v.status !== 'Realizada').sort((a, b) => a.dayOffset - b.dayOffset)[0];
  const rep = personById('v1');
  const news = products.filter((p) => p.isNew);
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
        <ListItem icon="grid-outline" title="Explorar catálogo" subtitle="Fichas y recursos multimedia" onPress={() => router.push('/medico/catalogo')} />
        <ListItem icon="add-circle-outline" title="Nueva solicitud" subtitle="Información o material de apoyo" onPress={() => router.push('/solicitud/nueva')} />
        <ListItem icon="people-outline" title="Mis visitadores" subtitle="Contactos y laboratorios" onPress={() => router.push('/contactos')} />
        <ListItem icon="time-outline" title="Historial de visitas" subtitle="Visitas recibidas y próximas" onPress={() => router.push('/historial')} />
      </View>

      <SectionHeader title="Novedades del catálogo" action="Ver todo" onAction={() => router.push('/medico/catalogo')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        {news.map((p) => (
          <PressableScale key={p.id} onPress={() => router.push(`/producto/${p.id}`)} style={{ width: 220 }} accessibilityLabel={`Ver ${p.name}`}>
            <ProductVisual product={p} height={120} />
            <Text style={[type.h3, { marginTop: space.sm }]}>{p.name}</Text>
            <Text style={type.caption}>{p.tagline}</Text>
          </PressableScale>
        ))}
      </ScrollView>

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
