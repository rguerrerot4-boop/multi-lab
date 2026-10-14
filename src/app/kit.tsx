import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Card, DemoNotice, PressableScale, Screen, styles } from '@/components/ui';
import { INITIAL_KIT, products } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// el inventario inicial es el de esta sesión: solo se cuentan las entregas firmadas desde que se abrió la app
const SESSION_START = Date.now();

// Kit de material de demostración que lleva el visitador
export default function Kit() {
  const { kit, myVisits } = useMine();
  const delivered = (pid: string, kind: 'muestra' | 'impreso') =>
    myVisits.reduce((s, v) => s + (v.report?.endedAt && v.report.endedAt > SESSION_START ? v.report.deliveries[pid]?.[kind] ?? 0 : 0), 0);
  const totalSamples = Object.values(kit).reduce((s, k) => s + k.muestra, 0);
  const totalPrinted = Object.values(kit).reduce((s, k) => s + k.impreso, 0);

  return (
    <Screen header={<AppHeader title="Mi kit" subtitle="Material de demostración" />}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Big icon="cube-outline" value={totalSamples} label="Muestras disponibles" />
        <Big icon="document-text-outline" value={totalPrinted} label="Impresos disponibles" />
      </View>
      <DemoNotice text="Inventario ficticio de demostración. Se descuenta al firmar cada visita." />

      {products.map((p) => {
        const k = kit[p.id];
        if (!k) return null;
        const start = INITIAL_KIT[p.id];
        const low = k.muestra <= 5;
        return (
          <PressableScale key={p.id} onPress={() => router.push(`/producto/${p.id}`)} accessibilityLabel={`${p.name}: ${k.muestra} muestras`}>
            <Card style={low ? { borderColor: colors.warning } : undefined}>
              <View style={styles.row}>
                <View style={{ width: 52 }}>
                  <ProductVisual product={p} height={52} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{p.name}</Text>
                  <Text style={type.caption}>{p.lab}</Text>
                </View>
                {low ? (
                  <View style={[styles.pill, { backgroundColor: colors.warningSoft }]}>
                    <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
                    <Text style={[styles.pillText, { color: colors.warning }]}>Reponer</Text>
                  </View>
                ) : null}
              </View>
              <Bar label="Muestras" value={k.muestra} max={start.muestra} given={delivered(p.id, 'muestra')} />
              <Bar label="Impresos" value={k.impreso} max={start.impreso} given={delivered(p.id, 'impreso')} />
            </Card>
          </PressableScale>
        );
      })}
    </Screen>
  );
}

function Big({ icon, value, label }: { icon: 'cube-outline' | 'document-text-outline'; value: number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 2 }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={type.h1}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
}

function Bar({ label, value, max, given }: { label: string; value: number; max: number; given: number }) {
  const pct = max ? value / max : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.label}>{label}</Text>
        <Text style={type.caption}>
          {value} de {max}
          {given ? ` · ${given} entregados hoy` : ''}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.round(pct * 100)}%`, backgroundColor: pct <= 0.3 ? colors.warning : colors.primary }} />
      </View>
    </View>
  );
}
