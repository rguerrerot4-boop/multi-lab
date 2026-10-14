import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { Avatar, Button, EmptyState, Screen, styles } from '@/components/ui';
import { formatClock } from '@/components/visit';
import { ReportSummary } from '@/components/VisitReport';
import { deliveredTotal, personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, space, type } from '@/theme';

const home = () => {
  try {
    router.dismissTo('/visitador');
  } catch {
    router.replace('/visitador');
  }
};

// Comprobante final de la visita
export default function ResumenVisita() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visits, sendMessage, chatWith, myVisits } = useMine();
  const v = visits.find((x) => x.id === id);
  const [sent, setSent] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 14 }),
      Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [pop, ring]);

  if (!v?.report) {
    return (
      <Screen>
        <EmptyState icon="document-outline" title="Resumen no disponible" body="" action={<Button label="Volver al inicio" onPress={home} />} />
      </Screen>
    );
  }
  const r = v.report;
  const doc = personById(v.doctorId);
  const total = deliveredTotal(r);
  const left = myVisits.filter((x) => x.dayOffset === 0 && (x.status === 'Programada' || x.status === 'En curso'));

  const share = () => {
    const lines = [
      `Resumen de la visita · ${doc.name}`,
      `Duración: ${formatClock((r.endedAt ?? Date.now()) - r.startedAt)}`,
      r.presented.length ? `Presentado: ${r.presented.map((p) => productById(p)?.name).join(', ')}` : '',
      total ? `Material entregado: ${total}` : '',
      r.nextSteps.length ? `Siguientes pasos: ${r.nextSteps.join(', ')}` : '',
      'Gracias por su tiempo.',
    ].filter(Boolean);
    sendMessage(chatWith(doc.id), lines.join('\n'));
    setSent(true);
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {left.length ? (
            <Button label={`Siguiente visita · ${personById(left[0].doctorId).name}`} icon="arrow-forward" onPress={() => {
                home();
                router.push(`/visita/${left[0].id}`);
              }} />
          ) : null}
          <Button label="Volver al inicio" variant={left.length ? 'secondary' : 'primary'} icon="home-outline" onPress={home} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.lg }}>
        <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.turquesa,
              opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }],
            }}
          />
          <Animated.View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
            <Ionicons name="checkmark" size={44} color={colors.white} />
          </Animated.View>
        </View>
        <Text style={[type.h1, { textAlign: 'center' }]}>Visita registrada</Text>
        <View style={styles.row}>
          <Avatar initials={doc.initials} size={28} tone="dark" />
          <Text style={type.label}>{doc.name}</Text>
        </View>
        <Text style={[type.bodyMuted, { textAlign: 'center' }]}>
          {total ? `Dejaste ${total} ${total === 1 ? 'material' : 'materiales'} y quedó firmado el acuse de recibo.` : 'La visita quedó firmada y guardada en tu historial.'}
        </Text>
      </View>

      <ReportSummary report={r} signerFallback={doc.name} />

      <Button
        label={sent ? 'Resumen enviado por chat' : 'Enviar resumen al profesional'}
        icon={sent ? 'checkmark' : 'send-outline'}
        variant={sent ? 'ghost' : 'secondary'}
        onPress={() => (sent ? router.push(`/chat/${chatWith(doc.id)}`) : share())}
      />
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.inkSubtle, textAlign: 'center' }}>Datos ficticios · Prototipo académico</Text>
    </Screen>
  );
}
