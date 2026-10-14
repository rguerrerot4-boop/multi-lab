import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Card, styles } from '@/components/ui';
import { formatClock, hourLabel, SignatureView } from '@/components/visit';
import { DELIVERY_KINDS, deliveredTotal, productById, type VisitReport } from '@/data/mock';
import { colors, radius, space, type } from '@/theme';

/** Resumen del registro de una visita: tiempos, presentado, material entregado, resultado y firma */
export function ReportSummary({ report, signerFallback }: { report: VisitReport; signerFallback?: string }) {
  const total = deliveredTotal(report);
  const rows = Object.entries(report.deliveries).filter(([, d]) => (d.muestra ?? 0) + (d.impreso ?? 0) + (d.digital ?? 0) > 0);
  const dur = report.endedAt ? report.endedAt - report.startedAt : 0;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat icon="time-outline" value={report.endedAt ? formatClock(dur) : '—'} label="Duración" />
        <Stat icon="easel-outline" value={String(report.presented.length)} label="Presentados" />
        <Stat icon="cube-outline" value={String(total)} label="Entregados" />
      </View>

      <Card>
        <Text style={type.overline}>Horario</Text>
        <Text style={type.body}>
          {hourLabel(report.startedAt)}
          {report.endedAt ? ` a ${hourLabel(report.endedAt)}` : ' · en curso'}
        </Text>
        {report.presented.length ? (
          <>
            <Text style={type.overline}>Productos presentados</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {report.presented.map((id) => (
                <View key={id} style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="checkmark" size={13} color={colors.primary} />
                  <Text style={[styles.pillText, { color: colors.ink }]}>{productById(id)?.name}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={type.overline}>Material entregado</Text>
          <Text style={type.label}>{total} en total</Text>
        </View>
        {rows.length ? (
          rows.map(([pid, d]) => (
            <View key={pid} style={{ gap: 6, paddingTop: 4 }}>
              <Text style={type.h3}>{productById(pid)?.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {DELIVERY_KINDS.filter((k) => (d[k.kind] ?? 0) > 0).map((k) => (
                  <View key={k.kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Ionicons name={k.icon} size={14} color={colors.primary} />
                    <Text style={type.caption}>
                      {k.short}: <Text style={{ color: colors.ink }}>{d[k.kind]}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text style={type.bodyMuted}>No se entregó material en esta visita.</Text>
        )}
      </Card>

      {report.interest || report.nextSteps.length || report.notes || report.followUpDays ? (
        <Card>
          <Text style={type.overline}>Resultado</Text>
          {report.interest ? <Line icon="pulse-outline" text={`Interés del profesional: ${report.interest}`} /> : null}
          {report.nextSteps.map((n) => (
            <Line key={n} icon="arrow-forward-circle-outline" text={n} />
          ))}
          {report.followUpDays ? <Line icon="calendar-outline" text={`Próxima visita sugerida en ${report.followUpDays} días`} /> : null}
          {report.notes ? <Text style={[type.bodyMuted, { fontStyle: 'italic' }]}>“{report.notes}”</Text> : null}
        </Card>
      ) : null}

      {report.signature ? (
        <Card>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={type.overline}>Firma de recepción</Text>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
          </View>
          <SignatureView signature={report.signature} />
          <Text style={type.caption}>
            {report.signature.name || signerFallback} · {new Date(report.signature.at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} {hourLabel(report.signature.at)}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: 'time-outline' | 'easel-outline' | 'cube-outline'; value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 2 }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={type.h2}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function Line({ icon, text }: { icon: 'pulse-outline' | 'arrow-forward-circle-outline' | 'calendar-outline'; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.inkMuted} />
      <Text style={[type.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}
