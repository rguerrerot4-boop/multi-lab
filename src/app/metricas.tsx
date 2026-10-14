import { Text, View } from 'react-native';
import { AppHeader, Card, DemoNotice, EmptyState, Screen, styles } from '@/components/ui';
import { useMine } from '@/store/AppStore';
import { colors, space, type } from '@/theme';

const LABELS: Record<string, string> = {
  login: 'Inicios de sesión',
  ficha_abierta: 'Fichas abiertas',
  ficha_seccion: 'Secciones de ficha consultadas',
  presentacion_iniciada: 'Presentaciones iniciadas',
  presentacion_cerrada: 'Presentaciones finalizadas',
  solicitud_creada: 'Solicitudes creadas',
  solicitud_estado: 'Cambios de estado',
  mensaje_enviado: 'Mensajes enviados',
  ficha_compartida: 'Fichas compartidas',
  visita_estado: 'Estados de visita registrados',
  visita_iniciada: 'Visitas iniciadas',
  visita_finalizada: 'Visitas firmadas y finalizadas',
  visita_descartada: 'Visitas descartadas',
};

// Registro de eventos de la sesión para pruebas de usabilidad controladas
export default function Metricas() {
  const { events } = useMine();
  const counts = events.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.name]: (acc[e.name] ?? 0) + 1 }), {});
  const start = events[0]?.t;
  const max = Math.max(1, ...Object.values(counts));

  return (
    <Screen header={<AppHeader title="Métricas de la prueba" />}>
      <DemoNotice text="Eventos registrados solo en esta sesión del prototipo. No son métricas reales de uso." />
      {events.length === 0 ? (
        <EmptyState icon="analytics-outline" title="Sin eventos todavía" body="Navega por la app y vuelve aquí para ver el registro." />
      ) : (
        <>
          <Card>
            <Text style={type.h3}>Resumen</Text>
            {Object.entries(counts).map(([k, n]) => (
              <View key={k} style={{ gap: 4 }}>
                <View style={[styles.row, { justifyContent: 'space-between' }]}>
                  <Text style={type.body}>{LABELS[k] ?? k}</Text>
                  <Text style={type.label}>{n}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primarySoft }}>
                  <View style={{ width: `${(n / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                </View>
              </View>
            ))}
          </Card>
          <Card>
            <Text style={type.h3}>Registro cronológico</Text>
            {events
              .slice()
              .reverse()
              .map((e, i) => (
                <View key={i} style={[styles.row, { justifyContent: 'space-between', gap: space.md }]}>
                  <Text style={[type.caption, { flex: 1 }]}>
                    {LABELS[e.name] ?? e.name}
                    {e.detail ? ` · ${e.detail}` : ''}
                  </Text>
                  <Text style={type.caption}>+{Math.round((e.t - start) / 1000)} s</Text>
                </View>
              ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
