import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SubmitButton } from '@/components/SubmitButton';
import { ProductVisual } from '@/components/ProductVisual';
import { Steps } from '@/components/Steps';
import { AppHeader, Avatar, Button, Card, DemoNotice, Field, Screen, styles, UrgencyPill } from '@/components/ui';
import { areaOf, labByName, labs, personById, productById, products, REQUEST_URGENCY, type Product, type RequestType, type RequestUrgency } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

const TYPES: { value: RequestType; desc: string; icon: 'document-text-outline' | 'folder-open-outline' | 'calendar-outline' | 'cube-outline' }[] = [
  { value: 'Información técnica', desc: 'Ficha técnica, estudios o documentación autorizada.', icon: 'document-text-outline' },
  { value: 'Material de apoyo', desc: 'Material informativo autorizado por el laboratorio.', icon: 'folder-open-outline' },
  { value: 'Muestra original', desc: 'Que el visitador traiga una muestra original del producto en su visita.', icon: 'cube-outline' },
  { value: 'Agendar visita', desc: 'Pedir que el visitador presente el producto.', icon: 'calendar-outline' },
];

// Flujo: elegir laboratorio → producto de su área → tipo y detalle → confirmar
export default function NuevaSolicitud() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { createRequest, userId } = useMine();
  const me = personById(userId ?? 'm1');
  const area = areaOf(me.title);
  const pre = productById(productId ?? '');
  const [step, setStep] = useState(pre ? 2 : 0);
  const [labName, setLabName] = useState(pre?.lab ?? '');
  const [pid, setPid] = useState(pre?.id ?? '');
  const [showOthers, setShowOthers] = useState(false);
  const [kind, setKind] = useState<RequestType | null>(null);
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<RequestUrgency | null>(null);
  const [error, setError] = useState<string>();
  const lab = labByName(labName);
  const p = productById(pid);
  const rep = lab ? personById(lab.repId) : null;
  const first = pre ? 2 : 0;

  const labProducts = products.filter((x) => x.lab === labName);
  const mineArea = labProducts.filter((x) => x.areas.includes(area));
  const otherArea = labProducts.filter((x) => !x.areas.includes(area));

  const next = () => {
    if (step === 0 && !labName) return setError('Elige un laboratorio.');
    if (step === 1 && !pid) return setError('Elige un producto.');
    if (step === 2 && !kind) return setError('Elige el tipo de solicitud.');
    if (step === 2 && !urgency) return setError('Elige el nivel de necesidad.');
    setError(undefined);
    if (step < 3) setStep(step + 1);
    else if (lab) {
      const id = createRequest({ productId: pid, type: kind!, notes, repId: lab.repId, urgency: urgency ?? undefined });
      router.replace({ pathname: '/solicitud/[id]', params: { id, nueva: '1' } });
    }
  };

  const productRow = (x: Product) => {
    const on = x.id === pid;
    return (
      <Pressable
        key={x.id}
        onPress={() => setPid(x.id)}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        accessibilityLabel={x.name}
        style={[styles.listItem, on && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
      >
        <View style={{ width: 52 }}>
          <ProductVisual product={x} height={52} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{x.name}</Text>
          <Text style={type.caption}>
            {x.category} · {x.areas.join(', ')}
          </Text>
        </View>
        <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
      </Pressable>
    );
  };

  return (
    <Screen
      header={<AppHeader title="Nueva solicitud" onBack={() => (step > first ? setStep(step - 1) : router.back())} />}
      footer={
        <>
          {error ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{error}</Text> : null}
          {step < 3 ? (
            <Button label="Continuar" iconRight="arrow-forward" onPress={next} />
          ) : (
            <SubmitButton
              label="Enviar solicitud"
              doneLabel="Solicitud enviada"
              onSubmit={() => (lab ? createRequest({ productId: pid, type: kind!, notes, repId: lab.repId, urgency: urgency ?? undefined }) : null)}
              onDone={(id) => id && router.replace({ pathname: '/solicitud/[id]', params: { id: String(id), nueva: '1' } })}
            />
          )}
        </>
      }
    >
      <Steps steps={['Laboratorio', 'Producto', 'Detalle', 'Confirmar']} current={step} />

      {step === 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.h2}>¿A qué laboratorio?</Text>
          <Text style={type.bodyMuted}>Tu solicitud llega al visitador que representa a ese laboratorio.</Text>
          {labs.map((l) => {
            const on = l.name === labName;
            const r = personById(l.repId);
            const inArea = products.filter((x) => x.lab === l.name && x.areas.includes(area)).length;
            return (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLabName(l.name);
                  setPid('');
                  setShowOthers(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={l.full}
                style={[styles.listItem, on && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: l.hue === colors.turquesa ? colors.primary : l.hue, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 18, color: colors.white }}>{l.name.slice(0, 1)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.h3}>{l.full}</Text>
                  <Text style={type.caption}>{l.tagline}</Text>
                  <View style={[styles.row, { gap: 6 }]}>
                    <Avatar initials={r.initials} size={20} tone="teal" />
                    <Text style={type.caption}>{r.name}</Text>
                  </View>
                  <Text style={[type.caption, { color: inArea ? colors.primary : colors.inkSubtle }]}>
                    {inArea ? `${inArea} ${inArea === 1 ? 'producto' : 'productos'} de ${area}` : `Sin productos de ${area}`}
                  </Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
              </Pressable>
            );
          })}
          <Text style={[type.caption, { textAlign: 'center' }]}>Laboratorios y productos ficticios de demostración.</Text>
        </View>
      ) : null}

      {step === 1 && lab ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.h2}>Productos de tu área</Text>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <View style={[styles.pill, { backgroundColor: colors.primary }]}>
              <Ionicons name="medkit-outline" size={12} color={colors.white} />
              <Text style={[styles.pillText, { color: colors.white }]}>{area}</Text>
            </View>
            <Text style={type.caption}>{lab.full}</Text>
          </View>
          {mineArea.length ? mineArea.map(productRow) : <Card><Text style={type.bodyMuted}>Este laboratorio no tiene productos de {area}. Puedes ver los de otras áreas.</Text></Card>}
          {otherArea.length ? (
            showOthers || !mineArea.length ? (
              <>
                <Text style={[type.overline, { marginTop: space.sm }]}>Otras áreas</Text>
                {otherArea.map(productRow)}
              </>
            ) : (
              <Button label={`Ver otras áreas (${otherArea.length})`} small variant="ghost" icon="chevron-down" onPress={() => setShowOthers(true)} />
            )
          ) : null}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: space.md }}>
          <Text style={type.h2}>¿Qué necesitas?</Text>
          {TYPES.map((t) => {
            const on = kind === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setKind(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.listItem, on && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: on ? colors.primary : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={t.icon} size={20} color={on ? colors.white : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{t.value}</Text>
                  <Text style={type.caption}>{t.desc}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[type.h2, { marginTop: space.sm }]}>Nivel de necesidad</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {REQUEST_URGENCY.map((u) => {
              const on = urgency === u.value;
              const tone = u.value === 'Urgente' ? { bg: colors.dangerSoft, fg: colors.danger } : u.value === 'Esta semana' ? { bg: colors.warningSoft, fg: colors.warning } : { bg: colors.primarySoft, fg: colors.primary };
              return (
                <Pressable
                  key={u.value}
                  onPress={() => setUrgency(u.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${u.value}: ${u.desc}`}
                  style={({ pressed }) => ({
                    flex: 1,
                    alignItems: 'center',
                    gap: 4,
                    paddingVertical: space.md,
                    paddingHorizontal: 6,
                    borderRadius: radius.md,
                    borderWidth: 1.5,
                    borderColor: on ? tone.fg : colors.border,
                    backgroundColor: on ? tone.bg : colors.surface,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Ionicons name={u.icon} size={20} color={on ? tone.fg : colors.inkSubtle} />
                  <Text style={[type.label, { color: on ? tone.fg : colors.ink, textAlign: 'center' }]}>{u.value}</Text>
                  <Text style={[type.caption, { textAlign: 'center', fontSize: 11, lineHeight: 14 }]}>{u.desc}</Text>
                </Pressable>
              );
            })}
          </View>
          <Field label="Comentario (opcional)" value={notes} onChangeText={setNotes} placeholder="Agrega detalles para el visitador" multiline />
          <DemoNotice text="Las solicitudes no incluyen venta ni dispensación de medicamentos." />
        </View>
      ) : null}

      {step === 3 && p && lab && rep ? (
        <View style={{ gap: space.md }}>
          <Text style={type.h2}>Revisa tu solicitud</Text>
          <Card>
            <View style={styles.row}>
              <View style={{ width: 64 }}>
                <ProductVisual product={p} height={64} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{p.name}</Text>
                <Text style={type.caption}>{lab.full} (ficticio)</Text>
              </View>
            </View>
            <Row label="Tipo" value={kind ?? ''} />
            <View style={{ gap: 4 }}>
              <Text style={type.caption}>Nivel de necesidad</Text>
              <UrgencyPill urgency={urgency ?? undefined} />
            </View>
            <Row label="Comentario" value={notes || 'Sin comentario'} />
          </Card>
          <Card>
            <Text style={type.overline}>Se enviará a</Text>
            <View style={styles.row}>
              <Avatar initials={rep.initials} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{rep.name}</Text>
                <Text style={type.caption}>{rep.title}</Text>
              </View>
            </View>
            <Text style={type.caption}>Recibirás una notificación cada vez que cambie el estado.</Text>
          </Card>
        </View>
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}
