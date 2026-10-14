import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, Button, Card, EmptyState, Screen, StatusPill, styles } from '@/components/ui';
import { personById, productById, REQUEST_FLOW } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, space, type } from '@/theme';

// Detalle y seguimiento de una solicitud
export default function SolicitudDetalle() {
  const { id, nueva } = useLocalSearchParams<{ id: string; nueva?: string }>();
  const { requests, role, advanceRequest, cancelRequest, chatWith } = useMine();
  const r = requests.find((x) => x.id === id);

  if (!r) {
    return (
      <Screen header={<AppHeader title="Solicitud" />}>
        <EmptyState icon="document-outline" title="Solicitud no encontrada" body="Puede que haya sido eliminada." />
      </Screen>
    );
  }

  const p = productById(r.productId);
  const other = personById(role === 'medico' ? r.repId : r.doctorId);
  const idx = REQUEST_FLOW.indexOf(r.status);
  const closed = r.status === 'Atendida' || r.status === 'Cancelada';
  const nextStatus = idx >= 0 && idx < REQUEST_FLOW.length - 1 ? REQUEST_FLOW[idx + 1] : null;

  return (
    <Screen
      header={<AppHeader title={r.code} onBack={nueva ? () => router.replace(role === 'medico' ? '/medico/solicitudes' : '/solicitudes') : undefined} />}
      footer={
        !closed ? (
          role === 'visitador' && nextStatus ? (
            <Button label={`Marcar como "${nextStatus}"`} icon="arrow-forward-circle-outline" onPress={() => advanceRequest(r.id)} />
          ) : role === 'medico' && r.status === 'Pendiente' ? (
            <Button
              label="Cancelar solicitud"
              variant="danger"
              icon="close-circle-outline"
              onPress={() =>
                Alert.alert('Cancelar solicitud', '¿Seguro que quieres cancelarla?', [
                  { text: 'No' },
                  { text: 'Sí, cancelar', style: 'destructive', onPress: () => cancelRequest(r.id) },
                ])
              }
            />
          ) : undefined
        ) : undefined
      }
    >
      {nueva ? (
        <View style={[styles.row, { backgroundColor: colors.successSoft, padding: space.md, borderRadius: 12 }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text style={[type.label, { color: colors.success, flex: 1 }]}>Solicitud enviada. {other.name} ya fue notificado.</Text>
        </View>
      ) : null}

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={type.overline}>{r.type}</Text>
          <StatusPill status={r.status} />
        </View>
        {p ? (
          <View style={styles.row}>
            <View style={{ width: 64 }}>
              <ProductVisual product={p} height={64} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{p.name}</Text>
              <Text style={type.caption}>{p.form}</Text>
            </View>
          </View>
        ) : null}
        {r.notes ? <Text style={type.body}>“{r.notes}”</Text> : null}
        <Text style={type.caption}>Creada: {r.createdAt}</Text>
      </Card>

      <Card>
        <Text style={type.h3}>Seguimiento</Text>
        {(r.status === 'Cancelada' ? [...REQUEST_FLOW.slice(0, Math.max(1, r.history.length - 1)), 'Cancelada' as const] : REQUEST_FLOW).map((s, i, arr) => {
          const h = r.history.find((x) => x.status === s);
          const done = !!h;
          const current = s === r.status;
          const color = s === 'Cancelada' ? colors.danger : done ? colors.primary : colors.borderStrong;
          return (
            <View key={s} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: done ? color : colors.surface,
                    borderWidth: 2,
                    borderColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done ? <Ionicons name={s === 'Cancelada' ? 'close' : 'checkmark'} size={12} color={colors.white} /> : null}
                </View>
                {i < arr.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: done ? colors.primary : colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space.md }}>
                <Text style={[type.label, { color: done ? colors.ink : colors.inkSubtle }]}>
                  {s}
                  {current ? ' · actual' : ''}
                </Text>
                <Text style={type.caption}>{h ? h.at : 'Pendiente'}</Text>
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={type.overline}>{role === 'medico' ? 'Visitador responsable' : 'Solicitado por'}</Text>
        <View style={styles.row}>
          <Avatar initials={other.initials} tone={other.role === 'medico' ? 'dark' : 'teal'} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{other.name}</Text>
            <Text style={type.caption}>{other.org}</Text>
          </View>
        </View>
        <Button label="Enviar mensaje" variant="secondary" icon="chatbubble-outline" small onPress={() => router.push(`/chat/${chatWith(other.id)}`)} />
      </Card>
    </Screen>
  );
}
