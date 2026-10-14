import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SubmitButton } from '@/components/SubmitButton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, Button, Card, EmptyState, Field, Screen, styles } from '@/components/ui';
import { SignaturePad } from '@/components/visit';
import { DELIVERY_KINDS, deliveredTotal, personById, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

// Acuse de recibo con firma del profesional, dibujada con el dedo.
export default function Firma() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { visits, userId, finishVisit } = useMine();
  const v = visits.find((x) => x.id === id);
  const doc = v ? personById(v.doctorId) : null;
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 320, h: 240 });
  const [name, setName] = useState(doc?.name ?? '');
  const [ok, setOk] = useState(false);
  const [drawing, setDrawing] = useState(false);

  if (!v || !v.report || !doc) {
    return (
      <Screen header={<AppHeader title="Firma" />}>
        <EmptyState icon="create-outline" title="No hay una visita en curso" body="Comienza una visita para registrar la firma." />
      </Screen>
    );
  }
  const r = v.report;
  const rep = personById(userId ?? 'v1');
  const total = deliveredTotal(r);
  const rows = Object.entries(r.deliveries).filter(([, d]) => (d.muestra ?? 0) + (d.impreso ?? 0) + (d.digital ?? 0) > 0);
  const ready = paths.length > 0 && ok && name.trim().length > 2;
  const today = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });

  const confirm = () => {
    finishVisit(v.id, { signature: { w: size.w, h: size.h, paths, name: name.trim(), at: Date.now() } });
    router.replace(`/resumen-visita/${v.id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <AppHeader title="Firma de recepción" subtitle={doc.name} />
      <ScrollView
        scrollEnabled={!drawing}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }}
      >
        <Card>
          <Text style={type.overline}>Acuse de recibo</Text>
          <Text style={type.body}>
            Confirmo que recibí de {rep.name} el siguiente material de demostración durante la visita del {today}.
          </Text>
          {rows.length ? (
            rows.map(([pid, d]) => (
              <View key={pid} style={[styles.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.sm }]}>
                <Text style={[type.label, { flex: 1 }]}>{productById(pid)?.name}</Text>
                <Text style={type.caption}>
                  {DELIVERY_KINDS.filter((k) => (d[k.kind] ?? 0) > 0)
                    .map((k) => `${d[k.kind]} ${d[k.kind] === 1 ? k.one : k.many}`)
                    .join(' · ')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={type.bodyMuted}>Sin material entregado. La firma confirma solo la visita.</Text>
          )}
          {total ? <Text style={[type.label, { textAlign: 'right' }]}>Total: {total}</Text> : null}
        </Card>

        <Field label="Nombre de quien firma" value={name} onChangeText={setName} icon="person-outline" autoCapitalize="words" />

        <View style={{ gap: space.sm }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Text style={type.h3}>Firma</Text>
            <View style={[styles.row, { gap: space.xs }]}>
              <SmallAction icon="arrow-undo-outline" label="Deshacer" disabled={!paths.length} onPress={() => setPaths((p) => p.slice(0, -1))} />
              <SmallAction icon="refresh-outline" label="Borrar" disabled={!paths.length} onPress={() => setPaths([])} />
            </View>
          </View>
          <SignaturePad paths={paths} onChange={setPaths} onSize={(w, h) => setSize({ w, h })} onDrawing={setDrawing} height={260} />
          <Text style={[type.caption, { textAlign: 'center' }]}>{doc.name}</Text>
        </View>

        <Pressable
          onPress={() => setOk((x) => !x)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ok }}
          style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: ok ? colors.primary : colors.border, padding: space.md }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: ok ? colors.primary : colors.borderStrong, backgroundColor: ok ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {ok ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
          </View>
          <Text style={[type.bodyMuted, { flex: 1 }]}>
            Confirmo la recepción del material detallado. Esta firma no implica compra, pedido ni prescripción.
          </Text>
        </Pressable>

        <SubmitButton
          label="Confirmar y finalizar visita"
          icon="checkmark-done-outline"
          doneLabel="Visita registrada"
          disabled={!ready}
          onSubmit={() => null}
          onDone={confirm}
        />
        <Text style={[type.caption, { textAlign: 'center' }]}>Prototipo académico: la firma se guarda solo durante la sesión y no tiene validez legal.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SmallAction({ icon, label, onPress, disabled }: { icon: 'arrow-undo-outline' | 'refresh-outline'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={[type.caption, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}
