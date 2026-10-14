import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { DoctorStatusPill, NeedCard } from '@/components/doctor';
import { StartVisitSheet } from '@/components/StartVisitSheet';
import { Avatar, BrandHeader, PressableScale, Screen, SectionHeader, StatusPill, styles } from '@/components/ui';
import { formatClock, LiveDot, useNow } from '@/components/visit';
import { dayLabel, deliveredTotal, matchProducts, personById, productById, type IconName, type ProductNeed } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, shadow, space, type } from '@/theme';

const WEEK_GOAL = 12;

// Dashboard del visitador médico
export default function VisitadorInicio() {
  const { userId, unreadNotices, unreadMessages, myRequests, myVisits, myChats, activeVisitId, kit, needs, doctorStatus } = useMine();
  const openNeeds = needs.filter((n) => n.status !== 'Atendida');
  const newNeed = needs.find((n) => n.status === 'Enviada');
  const me = personById(userId ?? 'v1');
  const now = useNow();
  const [sheet, setSheet] = useState(false);
  const today = myVisits.filter((v) => v.dayOffset === 0).sort((a, b) => a.time.localeCompare(b.time));
  const doneToday = today.filter((v) => v.status === 'Realizada').length;
  const next = today.find((v) => v.status === 'Programada' || v.status === 'Reprogramada');
  const active = myVisits.find((v) => v.id === activeVisitId && v.report && !v.report.endedAt);
  const pending = myRequests.filter((r) => r.status === 'Pendiente' || r.status === 'Recibida' || r.status === 'En revisión');
  const recentChats = myChats.filter((c) => c.messages.length).slice(0, 2);
  const deliveredToday = today.reduce((s, v) => s + deliveredTotal(v.report), 0);
  const weekDone = myVisits.filter((v) => v.status === 'Realizada' && v.dayOffset > -7 && v.dayOffset <= 0).length + 5; // base ficticia de la semana
  const doneAll = myVisits.filter((v) => v.status === 'Realizada').sort((a, b) => (b.report?.startedAt ?? 0) - (a.report?.startedAt ?? 0));
  const doneCount = doneAll.length;
  const lastDone = doneAll[0];
  const lowStock = Object.entries(kit).filter(([, k]) => k.muestra <= 5);
  const hour = new Date(now).getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <View style={{ gap: 2 }}>
        <Text style={[type.caption, { textTransform: 'capitalize' }]}>{date}</Text>
        <Text style={type.h1}>
          {hello}, {me.name.split(' ')[0]}
        </Text>
        <Text style={type.bodyMuted}>
          {today.length ? `Llevas ${doneToday} de ${today.length} visitas de hoy.` : 'No tienes visitas agendadas hoy.'}
        </Text>
      </View>

      {newNeed ? <NeedAlert need={newNeed} /> : null}

      {/* ---------- Acción rápida principal ---------- */}
      {active ? (
        <PressableScale
          onPress={() => router.push(`/en-visita/${active.id}`)}
          accessibilityLabel={`Continuar visita con ${personById(active.doctorId).name}`}
          style={{ backgroundColor: colors.petroleo, borderRadius: radius.xl, padding: space.lg, gap: space.md, ...shadow.card }}
        >
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { gap: 8 }]}>
              <LiveDot />
              <Text style={{ fontFamily: font.semibold, fontSize: 13, color: colors.white }}>Visita en curso</Text>
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 20, color: colors.white, fontVariant: ['tabular-nums'] }}>{formatClock(now - active.report!.startedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Avatar initials={personById(active.doctorId).initials} size={48} tone="teal" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 17, color: colors.white }}>{personById(active.doctorId).name}</Text>
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: '#A9C2C8' }}>
                {active.report!.presented.length} presentados · {deliveredTotal(active.report)} entregados
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={[type.label, { color: colors.white }]}>Continuar</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.white} />
            </View>
          </View>
        </PressableScale>
      ) : (
        <StartVisitHero
          onPress={() => setSheet(true)}
          subtitle={next ? `Siguiente: ${personById(next.doctorId).name} · ${next.time}` : 'Registra una visita sin cita'}
        />
      )}

      {/* ---------- Indicadores del día ---------- */}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Kpi icon="calendar-outline" value={`${doneToday}/${today.length}`} label="Visitas hoy" onPress={() => router.push('/visitador/agenda')} />
        <Kpi icon="cube-outline" value={String(deliveredToday)} label="Entregados" onPress={() => router.push('/kit')} />
        <Kpi icon="mail-unread-outline" value={String(pending.length)} label="Solicitudes" warn={pending.length > 0} onPress={() => router.push('/solicitudes')} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={type.label}>Meta de la semana</Text>
          <Text style={type.caption}>
            {Math.min(weekDone, WEEK_GOAL)} de {WEEK_GOAL} visitas
          </Text>
        </View>
        <Progress value={weekDone / WEEK_GOAL} />
      </View>

      {/* ---------- Accesos rápidos ---------- */}
      <SectionHeader title="Accesos rápidos" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
        <Shortcut icon="grid-outline" label="Catálogo" onPress={() => router.push('/visitador/catalogo')} />
        <Shortcut icon="calendar-outline" label="Agenda" onPress={() => router.push('/visitador/agenda')} />
        <Shortcut icon="map-outline" label="Mapa" onPress={() => router.push('/mapa')} />
        <Shortcut icon="people-outline" label="Contactos" onPress={() => router.push('/contactos')} />
        <Shortcut icon="briefcase-outline" label="Mi kit" onPress={() => router.push('/kit')} badge={lowStock.length} />
        <Shortcut icon="file-tray-full-outline" label="Solicitudes" onPress={() => router.push('/solicitudes')} badge={pending.length} />
        <Shortcut icon="chatbubbles-outline" label="Mensajes" onPress={() => router.push('/visitador/mensajes')} badge={unreadMessages} />
        <Shortcut icon="reader-outline" label="Registro" onPress={() => router.push('/registro')} />
      </View>

      {/* ---------- Ruta de hoy ---------- */}
      <SectionHeader title="Ruta de hoy" action="Ver mapa" onAction={() => router.push('/mapa')} />
      {today.length ? (
        <View>
          {today.map((v, i) => {
            const d = personById(v.doctorId);
            const done = v.status === 'Realizada';
            const live = v.status === 'En curso';
            return (
              <View key={v.id} style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ alignItems: 'center', width: 22 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      marginTop: space.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done ? colors.success : live ? colors.petroleo : colors.surface,
                      borderWidth: 2,
                      borderColor: done ? colors.success : live ? colors.petroleo : colors.primary,
                    }}
                  >
                    {done ? <Ionicons name="checkmark" size={13} color={colors.white} /> : <Text style={{ fontFamily: font.bold, fontSize: 10, color: live ? colors.white : colors.primary }}>{i + 1}</Text>}
                  </View>
                  {i < today.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.border }} /> : null}
                </View>
                <PressableScale
                  onPress={() => router.push(live ? `/en-visita/${v.id}` : `/visita/${v.id}`)}
                  accessibilityLabel={`${d.name}, ${v.time}, ${v.status}`}
                  style={{ flex: 1, marginBottom: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: live ? colors.petroleo : colors.border, padding: space.md, gap: 6 }}
                >
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <Text style={type.label}>{v.time}</Text>
                    <StatusPill status={v.status} />
                  </View>
                  <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                    <Text style={type.h3}>{d.name}</Text>
                    {!done ? <DoctorStatusPill status={doctorStatus[d.id]} /> : null}
                  </View>
                  <Text style={type.caption} numberOfLines={1}>
                    {v.place} · {v.productIds.map((id) => productById(id)?.name).join(', ') || 'Sin productos'}
                  </Text>
                  {done && v.report ? (
                    <Text style={[type.caption, { color: colors.success }]}>
                      {deliveredTotal(v.report)} entregados · firmado
                    </Text>
                  ) : null}
                </PressableScale>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={[styles.listItem, { justifyContent: 'center' }]}>
          <Text style={type.bodyMuted}>Día sin visitas agendadas.</Text>
        </View>
      )}

      {lastDone ? (
        <PressableScale onPress={() => router.push('/registro')} style={styles.listItem} accessibilityLabel="Abrir registro de visitas">
          <View style={styles.iconTile}>
            <Ionicons name="reader-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Registro de visitas · {doneCount}</Text>
            <Text style={type.caption} numberOfLines={1}>
              Última: {personById(lastDone.doctorId).name} · {dayLabel(lastDone.dayOffset)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
        </PressableScale>
      ) : null}

      {/* ---------- Kit ---------- */}
      {lowStock.length ? (
        <PressableScale onPress={() => router.push('/kit')} style={[styles.listItem, { backgroundColor: colors.warningSoft, borderColor: colors.warningSoft }]} accessibilityLabel="Ver mi kit">
          <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Quedan pocas muestras</Text>
            <Text style={type.caption}>{lowStock.map(([pid, k]) => `${productById(pid)?.name} (${k.muestra})`).join(' · ')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
        </PressableScale>
      ) : null}

      {/* ---------- Búsquedas de producto de los médicos ---------- */}
      {openNeeds.length ? (
        <>
          <SectionHeader title={`Solicitudes por palabras clave · ${openNeeds.length}`} />
          <View style={{ gap: space.sm }}>
            {openNeeds.map((n) => (
              <NeedCard key={n.id} need={n} forRep />
            ))}
          </View>
        </>
      ) : null}

      {/* ---------- Solicitudes ---------- */}
      <SectionHeader title="Solicitudes pendientes" action="Ver todas" onAction={() => router.push('/solicitudes')} />
      {pending.length ? (
        <View style={{ gap: space.sm }}>
          {pending.map((r) => (
            <PressableScale
              key={r.id}
              onPress={() => router.push(`/solicitud/${r.id}`)}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 }}
            >
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={type.label}>{personById(r.doctorId).name}</Text>
                <StatusPill status={r.status} />
              </View>
              <Text style={type.bodyMuted}>
                {r.type} · {productById(r.productId)?.name}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        <View style={styles.listItem}>
          <Text style={type.bodyMuted}>Estás al día. No hay solicitudes pendientes.</Text>
        </View>
      )}

      {/* ---------- Mensajes ---------- */}
      <SectionHeader title="Mensajes recientes" action={unreadMessages ? `${unreadMessages} sin leer` : 'Ver'} onAction={() => router.push('/visitador/mensajes')} />
      <View style={{ gap: space.sm }}>
        {recentChats.map((c) => {
          const other = personById(c.members.find((m) => m !== userId)!);
          const last = c.messages[c.messages.length - 1];
          return (
            <PressableScale key={c.id} onPress={() => router.push(`/chat/${c.id}`)} style={[styles.listItem]}>
              <Avatar initials={other.initials} tone="dark" size={40} />
              <View style={{ flex: 1 }}>
                <Text style={type.label}>{other.name}</Text>
                <Text style={type.caption} numberOfLines={1}>
                  {last.text}
                </Text>
              </View>
              {userId && c.unreadFor[userId] ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
            </PressableScale>
          );
        })}
      </View>

      <StartVisitSheet visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}

/** Botón grande "Comenzar visita" con un pulso suave alrededor del play */
function StartVisitHero({ onPress, subtitle }: { onPress: () => void; subtitle: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <PressableScale onPress={onPress} accessibilityLabel="Comenzar visita" style={{ borderRadius: radius.xl, overflow: 'hidden', ...shadow.card }}>
      <LinearGradient colors={[colors.primary, colors.petroleo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.turquesa,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.5] }) }],
            }}
          />
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="play" size={28} color={colors.primary} style={{ marginLeft: 4 }} />
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: font.bold, fontSize: 21, color: colors.white }}>Comenzar visita</Text>
          <Text style={{ fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: '#DDF1F4' }}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.white} />
      </LinearGradient>
    </PressableScale>
  );
}

function Kpi({ icon, value, label, onPress, warn }: { icon: IconName; value: string; label: string; onPress: () => void; warn?: boolean }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 4 }}>
      <View style={[styles.iconTile, { width: 32, height: 32, borderRadius: 10, backgroundColor: warn ? colors.warningSoft : colors.primarySoft }]}>
        <Ionicons name={icon} size={17} color={warn ? colors.warning : colors.primary} />
      </View>
      <Text style={type.h2}>{value}</Text>
      <Text style={type.caption} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Progress({ value }: { value: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.min(1, value), duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, w]);
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' }}>
      <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: colors.primary, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

function Shortcut({ icon, label, onPress, badge }: { icon: IconName; label: string; onPress: () => void; badge?: number }) {
  return (
    <View style={{ width: '25%', alignItems: 'center' }}>
    <PressableScale onPress={onPress} style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={label}>
      <View>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={type.caption} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
    </View>
  );
}

/** Alerta destacada cuando un médico avisa que necesita un producto */
function NeedAlert({ need }: { need: ProductNeed }) {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(400),
      ...[1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, useNativeDriver: true })),
    ]).start();
  }, [need.id, shake]);
  const doc = personById(need.doctorId);
  const top = matchProducts(need.keywords)[0];
  return (
    <Animated.View style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }}>
      <PressableScale
        onPress={() => router.push(`/necesidad/${need.id}`)}
        accessibilityLabel={`${doc.name} solicita un producto`}
        style={{ backgroundColor: colors.warningSoft, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.warning, padding: space.md, gap: space.sm }}
      >
        <View style={styles.row}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications" size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>{doc.name} solicita un producto</Text>
            <Text style={type.caption} numberOfLines={1}>
              “{need.keywords.join(', ')}” · {need.urgency}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </View>
        <View style={[styles.row, { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.sm }]}>
          <Ionicons name={top ? 'cube-outline' : 'help-circle-outline'} size={18} color={colors.primary} />
          <Text style={[type.caption, { flex: 1, color: colors.ink }]} numberOfLines={2}>
            {top ? `Coincide con uno de tus productos: ${top.product.name} (por “${top.hits.join(', ')}”)` : 'No coincide con tus productos. Respóndele igual.'}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}
