import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AppHeader, Avatar, Chip, EmptyState, PressableScale, Screen, Segmented, styles } from '@/components/ui';
import { formatClock, hourLabel } from '@/components/visit';
import { dateFor, dayLabel, deliveredTotal, people, personById, productById, type IconName, type Visit } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

type Period = 'semana' | 'mes' | 'todo';
const PERIOD_DAYS: Record<Period, number> = { semana: 7, mes: 30, todo: 9999 };

const INTEREST_STYLE: Record<string, { bg: string; fg: string }> = {
  Alto: { bg: colors.successSoft, fg: colors.success },
  Medio: { bg: colors.primarySoft, fg: colors.primary },
  Bajo: { bg: colors.warningSoft, fg: colors.warning },
};

// Registro de visitas: cada visita finalizada queda guardada aquí automáticamente
export default function Registro() {
  const { myVisits } = useMine();
  const [period, setPeriod] = useState<Period>('mes');
  const [doctor, setDoctor] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const done = useMemo(
    () =>
      myVisits
        .filter((v) => v.status === 'Realizada')
        .sort((a, b) => (b.report?.startedAt ?? dateFor(b.dayOffset).getTime()) - (a.report?.startedAt ?? dateFor(a.dayOffset).getTime())),
    [myVisits],
  );

  const term = q.trim().toLowerCase();
  const list = done.filter((v) => {
    if (-v.dayOffset >= PERIOD_DAYS[period]) return false;
    if (doctor && v.doctorId !== doctor) return false;
    if (!term) return true;
    const d = personById(v.doctorId);
    const prods = v.productIds.map((id) => productById(id)?.name ?? '').join(' ');
    return `${d.name} ${d.title} ${v.place} ${prods} ${v.report?.notes ?? ''}`.toLowerCase().includes(term);
  });

  // totales del periodo filtrado
  const delivered = list.reduce((s, v) => s + deliveredTotal(v.report), 0);
  const samples = list.reduce((s, v) => s + deliveredTotal(v.report, 'muestra'), 0);
  const doctorsSeen = new Set(list.map((v) => v.doctorId)).size;
  const timed = list.filter((v) => v.report?.endedAt);
  const avg = timed.length ? timed.reduce((s, v) => s + (v.report!.endedAt! - v.report!.startedAt), 0) / timed.length : 0;

  // agrupar por día
  const groups: { day: number; items: Visit[] }[] = [];
  for (const v of list) {
    const g = groups.find((x) => x.day === v.dayOffset);
    if (g) g.items.push(v);
    else groups.push({ day: v.dayOffset, items: [v] });
  }

  const doctors = people.filter((p) => p.role === 'medico' && done.some((v) => v.doctorId === p.id));

  return (
    <Screen header={<AppHeader title="Registro de visitas" subtitle={`${done.length} visitas registradas`} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Stat icon="checkmark-done-outline" value={String(list.length)} label="Visitas" />
        <Stat icon="people-outline" value={String(doctorsSeen)} label="Profesionales" />
        <Stat icon="cube-outline" value={String(delivered)} label={`Entregados · ${samples} muestras`} />
        <Stat icon="time-outline" value={avg ? formatClock(avg) : '—'} label="Duración promedio" />
      </View>

      <View style={[styles.input, { borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.inkMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar médico, lugar, producto o nota"
          placeholderTextColor={colors.inkSubtle}
          style={styles.inputText}
          accessibilityLabel="Buscar en el registro"
        />
        {q ? <Ionicons name="close-circle" size={18} color={colors.inkSubtle} onPress={() => setQ('')} accessibilityLabel="Borrar búsqueda" /> : null}
      </View>

      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'semana', label: '7 días' },
          { value: 'mes', label: '30 días' },
          { value: 'todo', label: 'Todo' },
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Chip label="Todos" selected={!doctor} onPress={() => setDoctor(null)} />
        {doctors.map((d) => (
          <Chip key={d.id} label={d.name} selected={doctor === d.id} onPress={() => setDoctor(doctor === d.id ? null : d.id)} />
        ))}
      </ScrollView>

      {groups.length === 0 ? (
        <EmptyState
          icon="file-tray-outline"
          title="Sin visitas en este filtro"
          body="Cuando finalices y firmes una visita, aparecerá aquí automáticamente."
        />
      ) : (
        groups.map((g) => (
          <View key={g.day} style={{ gap: space.sm }}>
            <Text style={[type.overline, { textTransform: 'capitalize' }]}>
              {dayLabel(g.day)}
              {g.day < -1 ? ` · hace ${-g.day} días` : ''}
            </Text>
            {g.items.map((v) => (
              <Entry key={v.id} v={v} />
            ))}
          </View>
        ))
      )}

      <Text style={[type.caption, { textAlign: 'center' }]}>Registro de demostración · Se guarda durante la sesión del prototipo</Text>
    </Screen>
  );
}

function Entry({ v }: { v: Visit }) {
  const d = personById(v.doctorId);
  const r = v.report;
  const total = deliveredTotal(r);
  const interest = r?.interest ? INTEREST_STYLE[r.interest] : null;
  return (
    <PressableScale
      onPress={() => router.push(`/visita/${v.id}`)}
      accessibilityLabel={`Visita con ${d.name}, ${dayLabel(v.dayOffset)}`}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}
    >
      <View style={styles.row}>
        <Avatar initials={d.initials} size={42} tone="dark" />
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{d.name}</Text>
          <Text style={type.caption} numberOfLines={1}>
            {r ? `${hourLabel(r.startedAt)}${r.endedAt ? ` a ${hourLabel(r.endedAt)}` : ''}` : v.time} · {v.place}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
      </View>

      <Text style={type.bodyMuted} numberOfLines={1}>
        {(r?.presented.length ? r.presented : v.productIds).map((id) => productById(id)?.name).join(' · ')}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {r ? (
          <>
            <Badge icon="cube-outline" text={`${total} entregados`} />
            {r.endedAt ? <Badge icon="time-outline" text={formatClock(r.endedAt - r.startedAt)} /> : null}
            {interest ? <Badge icon="pulse-outline" text={`Interés ${r.interest!.toLowerCase()}`} bg={interest.bg} fg={interest.fg} /> : null}
            {r.signature ? <Badge icon="create-outline" text="Firmada" bg={colors.successSoft} fg={colors.success} /> : null}
          </>
        ) : (
          <Badge icon="information-circle-outline" text="Sin registro detallado" />
        )}
      </View>

      {r?.notes ? (
        <Text style={[type.caption, { fontStyle: 'italic' }]} numberOfLines={2}>
          “{r.notes}”
        </Text>
      ) : null}
    </PressableScale>
  );
}

function Badge({ icon, text, bg = colors.bg, fg = colors.inkMuted }: { icon: IconName; text: string; bg?: string; fg?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={12} color={fg} />
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: fg }}>{text}</Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 2 }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={type.h2}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}
