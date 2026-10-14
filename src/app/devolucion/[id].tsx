import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { ago } from '@/components/doctor';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, Button, Card, Chip, EmptyState, Field, Screen, StatusPill, styles } from '@/components/ui';
import { personById, productById, RETURN_FLOW, type ReturnStatus } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Acción del visitador según el estado actual y notas rápidas sugeridas
const NEXT_ACTION: Partial<Record<ReturnStatus, { label: string; notes: string[] }>> = {
  Reportada: { label: 'Confirmar recepción del reporte', notes: ['Recibido, lo reviso hoy', 'Gracias por avisar'] },
  Recibida: { label: 'Pasar a revisión', notes: ['Consultando con el laboratorio', 'Revisando el lote'] },
  'En revisión': { label: 'Agendar retiro o reposición', notes: ['En mi próxima visita', 'Mañana por la tarde', 'Esta semana'] },
  'Retiro agendado': { label: 'Marcar como resuelta', notes: ['Material repuesto', 'Material retirado', 'Se repuso y se retiró el dañado'] },
};

// Detalle y seguimiento de una devolución de material
export default function Devolucion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { returns, role, advanceReturn, cancelReturn, chatWith } = useMine();
  const r = returns.find((x) => x.id === id);
  const isRep = role === 'visitador';
  const [note, setNote] = useState('');

  if (!r) {
    return (
      <Screen header={<AppHeader title="Devolución" />}>
        <EmptyState icon="arrow-undo-outline" title="Reporte no encontrado" body="" />
      </Screen>
    );
  }
  const p = productById(r.productId);
  const doc = personById(r.doctorId);
  const rep = personById(r.repId);
  const other = isRep ? doc : rep;
  const step = RETURN_FLOW.indexOf(r.status);
  const action = NEXT_ACTION[r.status];
  const done = r.status === 'Resuelta' || r.status === 'Cancelada';

  return (
    <Screen
      header={<AppHeader title={`Devolución ${r.code}`} subtitle={`${isRep ? doc.name : 'Reportada'} · ${ago(r.createdAt)}`} />}
      footer={
        isRep && action ? (
          <Button
            label={action.label}
            icon="arrow-forward"
            onPress={() => {
              advanceReturn(r.id, note.trim() || undefined);
              setNote('');
            }}
          />
        ) : !isRep && r.status === 'Reportada' ? (
          <Button label="Cancelar reporte" variant="danger" icon="close-circle-outline" onPress={() => cancelReturn(r.id)} />
        ) : undefined
      }
    >
      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <StatusPill status={r.status} />
          <Text style={type.caption}>{r.source.label}</Text>
        </View>
        <View style={styles.row}>
          {p ? (
            <View style={{ width: 56 }}>
              <ProductVisual product={p} height={56} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>{p?.name}</Text>
            <Text style={type.caption}>
              {r.qty} {r.qty === 1 ? 'unidad' : 'unidades'} · {r.material}
            </Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Row icon="alert-circle-outline" label="Motivo" text={r.reason} />
          <Row icon="swap-vertical-outline" label="Prefiere" text={r.want} />
        </View>
        {r.detail ? <Text style={[type.bodyMuted, { fontStyle: 'italic' }]}>“{r.detail}”</Text> : null}
        {r.photos.length ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {r.photos.map((u, i) => (
              <Image key={u} source={{ uri: u }} style={{ width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.border }} accessibilityLabel={`Foto ${i + 1} del material`} />
            ))}
          </View>
        ) : null}
      </Card>

      {/* contraparte */}
      <View style={styles.listItem}>
        <Avatar initials={other.initials} tone={isRep ? 'dark' : 'teal'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={type.label}>{other.name}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {isRep ? `${doc.title} · ${doc.city}` : 'Visitador a cargo del reporte'}
          </Text>
        </View>
        <Button label="Mensaje" small variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith(other.id)}`)} />
      </View>

      {/* seguimiento */}
      <Text style={type.h2}>Seguimiento</Text>
      <Card style={{ gap: 0 }}>
        {(r.status === 'Cancelada' ? [...RETURN_FLOW.slice(0, 1), 'Cancelada' as ReturnStatus] : RETURN_FLOW).map((s, i, arr) => {
          const h = r.history.find((x) => x.status === s);
          const reached = !!h;
          const current = s === r.status;
          return (
            <View key={s} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ alignItems: 'center', width: 24 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: reached ? (s === 'Cancelada' ? colors.danger : colors.primary) : colors.surface,
                    borderWidth: 2,
                    borderColor: reached ? (s === 'Cancelada' ? colors.danger : colors.primary) : colors.border,
                  }}
                >
                  {reached ? <Ionicons name={s === 'Cancelada' ? 'close' : 'checkmark'} size={14} color={colors.white} /> : null}
                </View>
                {i < arr.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: i < step ? colors.primary : colors.border }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: space.md }}>
                <Text style={[type.label, !reached && { color: colors.inkSubtle }, current && { color: colors.primary }]}>{s}</Text>
                {h ? <Text style={type.caption}>{ago(h.at)}</Text> : null}
                {h?.note ? <Text style={[type.bodyMuted, { marginTop: 2 }]}>{h.note}</Text> : null}
              </View>
            </View>
          );
        })}
      </Card>

      {isRep && action ? (
        <>
          <Text style={type.h3}>Nota para el médico</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {action.notes.map((n) => (
              <Chip key={n} label={n} selected={note === n} onPress={() => setNote(note === n ? '' : n)} />
            ))}
          </View>
          <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Escribe una nota para el médico" multiline />
        </>
      ) : null}

      {done ? (
        <View style={[styles.demo, { backgroundColor: r.status === 'Resuelta' ? colors.successSoft : colors.dangerSoft }]}>
          <Ionicons name={r.status === 'Resuelta' ? 'checkmark-circle-outline' : 'close-circle-outline'} size={16} color={r.status === 'Resuelta' ? colors.success : colors.danger} />
          <Text style={[type.caption, { flex: 1, color: r.status === 'Resuelta' ? colors.success : colors.danger }]}>
            {r.status === 'Resuelta' ? 'Este reporte quedó resuelto.' : 'Este reporte fue cancelado.'}
          </Text>
        </View>
      ) : null}
      <Text style={[type.caption, { textAlign: 'center' }]}>Material de demostración de productos ficticios. No es una devolución de compra.</Text>
    </Screen>
  );
}

function Row({ icon, label, text }: { icon: 'alert-circle-outline' | 'swap-vertical-outline'; label: string; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.inkMuted} />
      <Text style={[type.bodyMuted, { flex: 1 }]}>
        {label}: <Text style={{ color: colors.ink }}>{text}</Text>
      </Text>
    </View>
  );
}
