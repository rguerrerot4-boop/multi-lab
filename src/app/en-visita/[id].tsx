import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, Button, Card, Chip, EmptyState, Field, goBack, IconButton, PressableScale, Screen, styles } from '@/components/ui';
import { Counter, formatClock, LiveDot, useNow } from '@/components/visit';
import {
  dayLabel,
  DELIVERY_KINDS,
  deliveredTotal,
  DOCTOR_INFO,
  NEXT_STEPS,
  personById,
  productById,
  products,
  type DeliveryKind,
  type Interest,
} from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

const FOLLOW_UP = [
  { days: 7, label: '1 semana' },
  { days: 15, label: '2 semanas' },
  { days: 30, label: '1 mes' },
];

// Visita en curso: datos del profesional, productos, contador de material entregado y resultado.
export default function EnVisita() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visits, requests, kit, startVisit, updateReport, discardVisit, chatWith } = useMine();
  const v = visits.find((x) => x.id === id);
  const now = useNow();
  const [adding, setAdding] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const leaving = useRef(false);

  // si se entra directamente, la visita arranca sola
  useEffect(() => {
    if (!leaving.current && v && !v.report && v.status !== 'Realizada') startVisit(v.id);
  }, [v, startVisit]);

  if (!v) {
    return (
      <Screen>
        <EmptyState icon="calendar-outline" title="Visita no encontrada" body="" />
      </Screen>
    );
  }
  const r = v.report;
  if (r?.endedAt) {
    return (
      <Screen header={<AppHeader title="Visita finalizada" />}>
        <EmptyState
          icon="checkmark-done-outline"
          title="Esta visita ya fue registrada"
          body="Puedes revisar el resumen con el material entregado y la firma."
          action={<Button label="Ver resumen" onPress={() => router.replace(`/resumen-visita/${v.id}`)} />}
        />
      </Screen>
    );
  }
  const doc = personById(v.doctorId);
  const info = DOCTOR_INFO[doc.id];
  const past = visits.filter((x) => x.doctorId === doc.id && x.status === 'Realizada' && x.id !== v.id).sort((a, b) => b.dayOffset - a.dayOffset);
  const lastVisit = past[0];
  const openReq = requests.filter((q) => q.doctorId === doc.id && q.status !== 'Atendida' && q.status !== 'Cancelada');
  const productIds = r ? Object.keys(r.deliveries) : v.productIds;
  const others = products.filter((p) => !productIds.includes(p.id));
  const total = deliveredTotal(r);

  const setQty = (pid: string, kind: DeliveryKind, n: number) =>
    updateReport(v.id, (rep) => ({ ...rep, deliveries: { ...rep.deliveries, [pid]: { ...rep.deliveries[pid], [kind]: n } } }));
  const togglePresented = (pid: string) =>
    updateReport(v.id, (rep) => ({
      ...rep,
      presented: rep.presented.includes(pid) ? rep.presented.filter((x) => x !== pid) : [...rep.presented, pid],
    }));
  const addProduct = (pid: string) => {
    updateReport(v.id, (rep) => ({ ...rep, deliveries: { ...rep.deliveries, [pid]: {} } }));
    setAdding(false);
  };

  const header = (
    <View style={{ backgroundColor: colors.petroleo, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, gap: space.md }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <IconButton icon="chevron-down" label="Minimizar visita" onPress={() => goBack('/visitador')} bg="rgba(255,255,255,0.1)" color={colors.white} />
        <View style={[styles.row, { gap: 8 }]}>
          <LiveDot />
          <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white }}>Visita en curso</Text>
        </View>
        <View style={{ minWidth: 72, alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: font.bold, fontSize: 18, color: colors.white, fontVariant: ['tabular-nums'] }} accessibilityLabel="Tiempo de visita">
            {r ? formatClock(now - r.startedAt) : '00:00'}
          </Text>
        </View>
      </View>
      <View style={styles.row}>
        <Avatar initials={doc.initials} size={60} tone="teal" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 20, lineHeight: 25, color: colors.white }}>{doc.name}</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, color: '#CFE3E7' }}>{doc.title}</Text>
          <Text style={{ fontFamily: font.regular, fontSize: 12, color: '#A9C2C8' }} numberOfLines={1}>
            {v.place} · {doc.city}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <HeadAction icon="call-outline" label="Llamar" onPress={() => Linking.openURL(`tel:${doc.phone.replace(/\s/g, '')}`).catch(() => {})} />
        <HeadAction icon="chatbubble-outline" label="Mensaje" onPress={() => router.push(`/chat/${chatWith(doc.id)}`)} />
        <HeadAction icon="navigate-outline" label="Mapa" onPress={() => router.push(`/mapa?visita=${v.id}`)} />
      </View>
    </View>
  );

  return (
    <Screen
      bg={colors.bg}
      header={header}
      footer={
        <View style={{ gap: space.sm }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={type.caption}>
              {r?.presented.length ?? 0} presentados · {total} {total === 1 ? 'material entregado' : 'materiales entregados'}
            </Text>
          </View>
          <Button label="Finalizar y firmar" icon="create-outline" onPress={() => router.push(`/firma/${v.id}`)} />
        </View>
      }
    >
      {/* ---------- Ficha del profesional ---------- */}
      <Card>
        <Text style={type.overline}>Sobre el profesional</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <MiniStat value={String(past.length)} label="Visitas previas" />
          <MiniStat value={lastVisit ? dayLabel(lastVisit.dayOffset) : '—'} label="Última visita" />
          <MiniStat value={String(openReq.length)} label="Solicitudes abiertas" warn={openReq.length > 0} />
        </View>
        {info ? (
          <View style={{ gap: 8 }}>
            <InfoRow icon="time-outline" label="Atención" text={info.hours} />
            <InfoRow icon="people-outline" label="Pacientes" text={info.patients} />
            <InfoRow icon="heart-outline" label="Prefiere" text={info.prefers} />
          </View>
        ) : null}
        {info?.tip || lastVisit?.notes ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, gap: 4 }}>
            <View style={styles.row}>
              <Ionicons name="bulb-outline" size={16} color={colors.primary} />
              <Text style={type.label}>Para esta visita</Text>
            </View>
            {info?.tip ? <Text style={type.bodyMuted}>{info.tip}</Text> : null}
            {lastVisit?.notes ? <Text style={type.bodyMuted}>Última nota: “{lastVisit.notes}”</Text> : null}
          </View>
        ) : null}
        {openReq.map((q) => (
          <PressableScale key={q.id} onPress={() => router.push(`/solicitud/${q.id}`)} style={[styles.row, { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: space.md }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={[type.label, { flex: 1 }]}>
              {q.code} · {q.type} · {q.status}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.inkSubtle} />
          </PressableScale>
        ))}
      </Card>

      {/* ---------- Productos ---------- */}
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.h2}>Productos</Text>
        <Text style={type.caption}>Toca la casilla al presentarlo</Text>
      </View>
      <View style={{ gap: space.sm }}>
        {productIds.map((pid) => {
          const p = productById(pid);
          if (!p) return null;
          const done = r?.presented.includes(pid);
          return (
            <View key={pid} style={[styles.listItem, done && { borderColor: colors.primary }]}>
              <Pressable
                onPress={() => togglePresented(pid)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!done }}
                accessibilityLabel={`${p.name} presentado`}
                hitSlop={8}
                style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: done ? colors.primary : colors.borderStrong, backgroundColor: done ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                {done ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
              </Pressable>
              <View style={{ width: 52 }}>
                <ProductVisual product={p} height={52} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{p.name}</Text>
                <Text style={type.caption} numberOfLines={1}>
                  {p.form}
                </Text>
              </View>
              <PressableScale
                onPress={() => router.push({ pathname: '/presentacion/[id]', params: { id: pid, visita: v.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 }}
                accessibilityLabel={`Presentar ${p.name}`}
              >
                <Ionicons name="play" size={13} color={colors.white} />
                <Text style={[type.label, { color: colors.white }]}>Presentar</Text>
              </PressableScale>
            </View>
          );
        })}
        {adding ? (
          <Card>
            <Text style={type.label}>Agregar otro producto a la visita</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {others.map((p) => (
                <Chip key={p.id} label={p.name} icon="add" onPress={() => addProduct(p.id)} />
              ))}
            </View>
            <Button label="Cancelar" small variant="ghost" onPress={() => setAdding(false)} />
          </Card>
        ) : others.length ? (
          <Button label="Agregar producto" small variant="secondary" icon="add" onPress={() => setAdding(true)} />
        ) : null}
      </View>

      {/* ---------- Contador de material entregado ---------- */}
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.h2}>Material que dejas</Text>
        <View style={{ backgroundColor: total ? colors.primary : colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={[type.label, { color: total ? colors.white : colors.primary }]} accessibilityLabel={`${total} en total`}>
            {total} en total
          </Text>
        </View>
      </View>
      <Text style={[type.caption, { marginTop: -space.sm }]}>Material de demostración de tu kit. No es una venta ni un pedido.</Text>
      <View style={{ gap: space.sm }}>
        {productIds.map((pid) => {
          const p = productById(pid);
          if (!p || !r) return null;
          const d = r.deliveries[pid] ?? {};
          const sub = (d.muestra ?? 0) + (d.impreso ?? 0) + (d.digital ?? 0);
          return (
            <Card key={pid} style={{ gap: space.sm }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={type.h3}>{p.name}</Text>
                {sub ? <Text style={type.label}>{sub}</Text> : null}
              </View>
              {DELIVERY_KINDS.map((k, i) => {
                const stock = kit[pid]?.[k.kind] ?? 0;
                const max = k.kind === 'digital' ? 1 : stock;
                const val = d[k.kind] ?? 0;
                const left = stock - val;
                return (
                  <View key={k.kind} style={[styles.row, { paddingTop: i ? space.sm : 0, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }]}>
                    <View style={[styles.iconTile, { width: 36, height: 36 }]}>
                      <Ionicons name={k.icon} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.label}>{k.label}</Text>
                      <Text style={[type.caption, k.kind !== 'digital' && left <= 3 && { color: colors.warning }]}>
                        {k.kind === 'digital' ? (val ? 'Enviada' : 'Sin enviar') : `Quedan ${left} en tu kit`}
                      </Text>
                    </View>
                    <Counter value={val} max={max} label={`${k.short.toLowerCase()} de ${p.name}`} onChange={(n) => setQty(pid, k.kind, n)} />
                  </View>
                );
              })}
            </Card>
          );
        })}
      </View>

      {/* ---------- Resultado ---------- */}
      {r ? (
        <>
          <Text style={type.h2}>Resultado de la visita</Text>
          <Card>
            <Text style={type.label}>Interés del profesional</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {(['Alto', 'Medio', 'Bajo'] as Interest[]).map((lv) => (
                <Chip key={lv} label={lv} selected={r.interest === lv} onPress={() => updateReport(v.id, (rep) => ({ ...rep, interest: rep.interest === lv ? undefined : lv }))} />
              ))}
            </View>
            <Text style={type.label}>Siguientes pasos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {NEXT_STEPS.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  selected={r.nextSteps.includes(n)}
                  onPress={() =>
                    updateReport(v.id, (rep) => ({
                      ...rep,
                      nextSteps: rep.nextSteps.includes(n) ? rep.nextSteps.filter((x) => x !== n) : [...rep.nextSteps, n],
                    }))
                  }
                />
              ))}
            </View>
            <Text style={type.label}>Próxima visita</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {FOLLOW_UP.map((f) => (
                <Chip
                  key={f.days}
                  icon="calendar-outline"
                  label={f.label}
                  selected={r.followUpDays === f.days}
                  onPress={() => updateReport(v.id, (rep) => ({ ...rep, followUpDays: rep.followUpDays === f.days ? undefined : f.days }))}
                />
              ))}
            </View>
            <Field
              label="Notas"
              value={r.notes}
              onChangeText={(t) => updateReport(v.id, (rep) => ({ ...rep, notes: t }))}
              placeholder="Acuerdos, dudas del profesional, pendientes…"
              multiline
            />
          </Card>
        </>
      ) : null}

      {confirmDiscard ? (
        <Card style={{ borderColor: colors.dangerSoft }}>
          <Text style={type.h3}>¿Descartar esta visita?</Text>
          <Text style={type.bodyMuted}>Se borrará lo registrado y la visita volverá a quedar programada.</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Seguir" small variant="secondary" onPress={() => setConfirmDiscard(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Descartar"
                small
                variant="danger"
                onPress={() => {
                  leaving.current = true;
                  discardVisit(v.id);
                  goBack('/visitador');
                }}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Button label="Descartar visita" small variant="ghost" icon="trash-outline" onPress={() => setConfirmDiscard(true)} />
      )}
    </Screen>
  );
}

function HeadAction({ icon, label, onPress }: { icon: 'call-outline' | 'chatbubble-outline' | 'navigate-outline'; label: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={label}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)' }}
    >
      <Ionicons name={icon} size={16} color={colors.white} />
      <Text style={[type.label, { color: colors.white }]}>{label}</Text>
    </PressableScale>
  );
}

function MiniStat({ value, label, warn }: { value: string; label: string; warn?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: warn ? colors.warningSoft : colors.bg, borderRadius: radius.md, padding: space.sm, gap: 2 }}>
      <Text style={[type.h3, warn && { color: colors.warning }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, text }: { icon: 'time-outline' | 'people-outline' | 'heart-outline'; label: string; text: string }) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      <Ionicons name={icon} size={16} color={colors.inkMuted} style={{ marginTop: 2 }} />
      <Text style={[type.bodyMuted, { flex: 1 }]}>
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{label}: </Text>
        {text}
      </Text>
    </View>
  );
}
