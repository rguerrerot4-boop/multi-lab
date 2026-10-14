import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppHeader, BrandHeader, Button, Chip, EmptyState, PressableScale, Screen, StatusPill, styles, UrgencyPill } from '@/components/ui';
import { personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

const FILTERS = ['Activas', 'Atendidas', 'Canceladas', 'Todas'] as const;

export default function Solicitudes({ withBack = false }: { withBack?: boolean }) {
  const { role, myRequests, unreadNotices } = useMine();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Activas');

  const list = myRequests.filter((r) =>
    filter === 'Todas'
      ? true
      : filter === 'Atendidas'
        ? r.status === 'Atendida'
        : filter === 'Canceladas'
          ? r.status === 'Cancelada'
          : r.status !== 'Atendida' && r.status !== 'Cancelada',
  );

  return (
    <Screen
      header={
        withBack ? (
          <AppHeader title="Solicitudes recibidas" />
        ) : (
          <BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />
        )
      }
    >
      {!withBack ? (
        <View style={{ gap: 4 }}>
          <Text style={type.h1}>Mis solicitudes</Text>
          <Text style={type.bodyMuted}>Consulta en qué estado está cada gestión sin tener que preguntar.</Text>
        </View>
      ) : null}
      {role === 'medico' ? (
        <Button label="Nueva solicitud" icon="add" onPress={() => router.push('/solicitud/nueva')} />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {list.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No hay solicitudes aquí"
          body={role === 'medico' ? 'Puedes iniciar una solicitud desde la ficha de cualquier producto.' : 'Cuando un profesional te envíe una solicitud, aparecerá aquí.'}
        />
      ) : (
        <View style={{ gap: space.md }}>
          {list.map((r) => {
            const p = productById(r.productId);
            const other = personById(role === 'medico' ? r.repId : r.doctorId);
            return (
              <PressableScale
                key={r.id}
                onPress={() => router.push(`/solicitud/${r.id}`)}
                accessibilityLabel={`Solicitud ${r.code}, ${r.status}`}
                style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.sm }}
              >
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text style={type.overline}>{r.code}</Text>
                  <StatusPill status={r.status} />
                </View>
                <Text style={type.h3}>{p?.name}</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                  <Text style={type.bodyMuted}>{r.type}</Text>
                  <UrgencyPill urgency={r.urgency} />
                </View>
                <Text style={type.caption}>
                  {role === 'medico' ? 'Visitador' : 'Solicitado por'}: {other.name} · {r.createdAt}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
