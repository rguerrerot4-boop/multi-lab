import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, Button, Card, Chip, EmptyState, Field, PressableScale, Screen, StatusPill, styles } from '@/components/ui';
import { dayLabel, personById, productById, type Visit } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

const STATUSES: Visit['status'][] = ['Programada', 'En curso', 'Realizada', 'Reprogramada'];

// Detalle de visita: datos, productos a presentar, notas y registro de estado
export default function VisitaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visits, role, setVisitStatus, setVisitNotes, chatWith } = useMine();
  const v = visits.find((x) => x.id === id);
  const [notes, setNotes] = useState(v?.notes ?? '');
  const [saved, setSaved] = useState(false);

  if (!v) {
    return (
      <Screen header={<AppHeader title="Visita" />}>
        <EmptyState icon="calendar-outline" title="Visita no encontrada" body="" />
      </Screen>
    );
  }

  const doc = personById(v.doctorId);
  const rep = personById('v1');
  const isRep = role === 'visitador';
  const counterpart = isRep ? doc : rep;

  return (
    <Screen
      header={<AppHeader title="Detalle de visita" subtitle={`${dayLabel(v.dayOffset)} · ${v.time}`} />}
      footer={
        isRep && v.status !== 'Realizada' ? (
          <Button
            label="Iniciar presentación"
            icon="play-circle-outline"
            onPress={() => {
              if (v.status === 'Programada') setVisitStatus(v.id, 'En curso');
              router.push({ pathname: '/presentacion/[id]', params: { id: v.productIds[0], visita: v.id } });
            }}
          />
        ) : undefined
      }
    >
      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <StatusPill status={v.status} />
          <Text style={type.caption}>
            {dayLabel(v.dayOffset)} · {v.time}
          </Text>
        </View>
        <View style={styles.row}>
          <Avatar initials={counterpart.initials} size={52} tone={counterpart.role === 'medico' ? 'dark' : 'teal'} />
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{counterpart.name}</Text>
            <Text style={type.caption}>{counterpart.title}</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Ionicons name="business-outline" size={16} color={colors.inkMuted} />
          <Text style={[type.body, { flex: 1 }]}>{v.place}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={16} color={colors.inkMuted} />
          <Text style={[type.bodyMuted, { flex: 1 }]}>{v.address}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Mensaje" small variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith(counterpart.id)}`)} />
          </View>
          {isRep ? (
            <View style={{ flex: 1 }}>
              <Button label="Ver en mapa" small variant="secondary" icon="map-outline" onPress={() => router.push(`/mapa?visita=${v.id}`)} />
            </View>
          ) : null}
        </View>
      </Card>

      <Text style={type.h2}>Productos de la visita</Text>
      <View style={{ gap: space.sm }}>
        {v.productIds.map((pid) => {
          const p = productById(pid);
          if (!p) return null;
          return (
            <PressableScale
              key={pid}
              onPress={() => router.push(`/producto/${pid}`)}
              style={[styles.listItem]}
              accessibilityLabel={`Ver ficha de ${p.name}`}
            >
              <View style={{ width: 60 }}>
                <ProductVisual product={p} height={60} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{p.name}</Text>
                <Text style={type.caption}>{p.tagline}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
            </PressableScale>
          );
        })}
      </View>

      {isRep ? (
        <>
          <Text style={type.h2}>Registrar estado</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {STATUSES.map((s) => (
              <Chip key={s} label={s} selected={v.status === s} onPress={() => setVisitStatus(v.id, s)} />
            ))}
          </View>
          <Card>
            <Field label="Notas de la visita" value={notes} onChangeText={(t) => { setNotes(t); setSaved(false); }} placeholder="Acuerdos, pedidos de información, próximos pasos…" multiline />
            <Button
              label={saved ? 'Notas guardadas' : 'Guardar notas'}
              icon={saved ? 'checkmark' : 'save-outline'}
              variant={saved ? 'ghost' : 'secondary'}
              small
              onPress={() => {
                setVisitNotes(v.id, notes);
                setSaved(true);
              }}
            />
          </Card>
        </>
      ) : v.notes ? (
        <Card style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg }}>
          <Text style={type.overline}>Nota del visitador</Text>
          <Text style={type.body}>{v.notes}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
