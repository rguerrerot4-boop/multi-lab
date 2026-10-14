import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SubmitButton } from '@/components/SubmitButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductVisual } from '@/components/ProductVisual';
import { Button, Chip, Field, PressableScale, styles } from '@/components/ui';
import {
  DOCTOR_STATES,
  labOfRep,
  matchProducts,
  NEED_SUGGESTIONS,
  normalize,
  personById,
  type DoctorState,
  type DoctorStatus,
  type NeedUrgency,
  type ProductNeed,
} from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

export const STATE_STYLE: Record<DoctorState, { bg: string; fg: string; dot: string }> = {
  libre: { bg: colors.successSoft, fg: colors.success, dot: colors.success },
  consulta: { bg: colors.warningSoft, fg: colors.warning, dot: colors.warning },
  ausente: { bg: colors.bg, fg: colors.inkMuted, dot: colors.inkSubtle },
};

export const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

/** Pastilla con el estado del médico (libre, en consulta, no disponible) */
export function DoctorStatusPill({ status, withTime }: { status?: DoctorStatus; withTime?: boolean }) {
  if (!status) return null;
  const s = STATE_STYLE[status.state];
  const def = DOCTOR_STATES.find((d) => d.state === status.state)!;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Estado: ${def.short}`}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.dot }} />
      <Text style={[styles.pillText, { color: s.fg }]}>
        {def.short}
        {status.until && status.state !== 'libre' ? ` · ${status.until}` : ''}
        {withTime ? ` · ${ago(status.at)}` : ''}
      </Text>
    </View>
  );
}

const UNTIL = ['por 30 min', 'por 1 hora', 'hasta el final del día'];

/** Tarjeta del médico para cambiar su estado */
export function MyStatusCard() {
  const { userId, doctorStatus, setMyStatus } = useMine();
  const st = doctorStatus[userId ?? 'm1'];
  const current = st?.state ?? 'libre';
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    glow.setValue(0);
    Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [current, glow]);

  const s = STATE_STYLE[current];
  return (
    <Animated.View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1.5,
        borderColor: glow.interpolate({ inputRange: [0, 1], outputRange: [s.dot, colors.border] }),
        padding: space.lg,
        gap: space.md,
      }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <View style={{ flex: 1 }}>
          <Text style={type.overline}>Tu estado</Text>
          <Text style={type.caption}>Los visitadores lo ven antes de pasar por tu consultorio.</Text>
        </View>
        <DoctorStatusPill status={st} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {DOCTOR_STATES.map((d) => {
          const on = current === d.state;
          const c = STATE_STYLE[d.state];
          return (
            <Pressable
              key={d.state}
              onPress={() => setMyStatus({ state: d.state, until: d.state === 'consulta' ? st?.until ?? UNTIL[1] : undefined })}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.label}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                gap: 6,
                paddingVertical: space.md,
                borderRadius: radius.md,
                borderWidth: 1.5,
                borderColor: on ? c.dot : colors.border,
                backgroundColor: on ? c.bg : colors.surface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name={d.icon} size={22} color={on ? c.fg : colors.inkSubtle} />
              <Text style={[type.label, { color: on ? c.fg : colors.inkMuted, textAlign: 'center' }]} numberOfLines={1}>
                {d.short}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current === 'consulta' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {UNTIL.map((u) => (
            <Chip key={u} label={u} icon="time-outline" selected={st?.until === u} onPress={() => setMyStatus({ state: 'consulta', until: u })} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const URGENCY: NeedUrgency[] = ['Sin prisa', 'Esta semana', 'Lo antes posible'];

/** Ventana del médico: "Necesito un producto" con palabras clave */
export function NeedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createNeed } = useMine();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [text, setText] = useState('');
  const [keys, setKeys] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState<NeedUrgency>('Esta semana');
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setText('');
      setKeys([]);
      setNote('');
      setUrgency('Esta semana');
      setSent(null);
    }
  }, [visible]);

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter((x) => x.length > 1);
    if (!parts.length) return;
    setKeys((k) => {
      const next = [...k];
      for (const p of parts) if (!next.some((x) => normalize(x) === normalize(p))) next.push(p);
      return next.slice(0, 8);
    });
    setText('');
  };
  const allKeys = text.trim().length > 1 ? [...keys, text.trim()] : keys;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Cerrar" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: height * 0.92, paddingBottom: insets.bottom + space.md }}>
          <View style={{ alignItems: 'center', paddingTop: space.sm }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          </View>
          {sent ? (
            <View style={{ padding: space.xl, gap: space.md, alignItems: 'center' }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="cloud-done" size={34} color={colors.white} />
              </View>
              <Text style={[type.h2, { textAlign: 'center' }]}>Solicitud publicada</Text>
              <View style={[styles.pill, { alignSelf: 'center', backgroundColor: colors.successSoft }]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={[styles.pillText, { color: colors.success }]}>Estado: Publicada</Text>
              </View>
              <Text style={[type.bodyMuted, { textAlign: 'center' }]}>“{allKeys.join(', ')}”</Text>
              <View style={{ width: '100%', gap: space.sm }}>
                <Button
                  label="Ver seguimiento"
                  icon="eye-outline"
                  onPress={() => {
                    onClose();
                    router.push(`/necesidad/${sent}`);
                  }}
                />
                <Button label="Listo" variant="secondary" onPress={onClose} />
              </View>
            </View>
          ) : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
              <Text style={type.h2}>Necesito un producto</Text>
              <Text style={type.bodyMuted}>Describe con palabras clave lo que necesitas y publica tu solicitud.</Text>

              <Text style={type.label}>Palabras clave</Text>
              <View style={[styles.input, { flexWrap: 'wrap', paddingVertical: 8, borderColor: keys.length ? colors.primary : colors.border, minHeight: 54 }]}>
                {keys.map((k) => (
                  <Pressable
                    key={k}
                    onPress={() => setKeys((x) => x.filter((y) => y !== k))}
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${k}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, borderRadius: radius.pill, paddingLeft: 10, paddingRight: 6, paddingVertical: 4 }}
                  >
                    <Text style={[type.label, { color: colors.white }]}>{k}</Text>
                    <Ionicons name="close-circle" size={16} color={colors.white} />
                  </Pressable>
                ))}
                <TextInput
                  value={text}
                  onChangeText={(t) => (/[,;\n]/.test(t) ? add(t) : setText(t))}
                  onSubmitEditing={() => add(text)}
                  blurOnSubmit={false}
                  returnKeyType="done"
                  placeholder={keys.length ? 'Otra palabra…' : 'Ej.: piel seca, ceramidas'}
                  placeholderTextColor={colors.inkSubtle}
                  style={[styles.inputText, { minWidth: 140 }]}
                  accessibilityLabel="Escribe una palabra clave"
                />
              </View>
              <Text style={[type.caption, { marginTop: -6 }]}>Separa con coma o pulsa Enter. Toca una palabra para quitarla.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {NEED_SUGGESTIONS.filter((s) => !keys.some((k) => normalize(k) === normalize(s))).map((s) => (
                  <Chip key={s} label={s} icon="add" onPress={() => add(s)} />
                ))}
              </View>

              <Text style={type.label}>¿Para cuándo?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {URGENCY.map((u) => (
                  <Chip key={u} label={u} selected={urgency === u} onPress={() => setUrgency(u)} />
                ))}
              </View>
              <Field label="Comentario (opcional)" value={note} onChangeText={setNote} placeholder="Ej.: quiero conocer texturas o material de apoyo" multiline />
              <Text style={type.caption}>No incluyas datos de pacientes. Esto no es un pedido ni una compra.</Text>
              <SubmitButton
                label="Publicar solicitud"
                icon="cloud-upload-outline"
                doneLabel="Solicitud publicada"
                disabled={!allKeys.length}
                onSubmit={() => createNeed({ keywords: allKeys, note: note.trim(), urgency })}
                onDone={(id) => setSent(String(id))}
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Nombre del estado según quién lo mira */
export const needLabel = (st: ProductNeed['status'], forRep?: boolean) =>
  st === 'Enviada' ? (forRep ? 'Nueva' : 'Publicada') : st === 'Atendida' ? 'Respondida' : 'Vista';

const NEED_STYLE: Record<ProductNeed['status'], { bg: string; fg: string }> = {
  Enviada: { bg: colors.warningSoft, fg: colors.warning },
  Vista: { bg: colors.primarySoft, fg: colors.primary },
  Atendida: { bg: colors.successSoft, fg: colors.success },
};

/** Tarjeta de una búsqueda de producto (para ambos roles) */
export function NeedCard({ need, forRep }: { need: ProductNeed; forRep?: boolean }) {
  const { userId } = useMine();
  const matches = forRep ? matchProducts(need.keywords, labOfRep(userId ?? 'v1')?.name) : [];
  const doc = personById(need.doctorId);
  const st = NEED_STYLE[need.status];
  return (
    <PressableScale
      onPress={() => router.push(`/necesidad/${need.id}`)}
      accessibilityLabel={`Búsqueda ${need.keywords.join(', ')}`}
      style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: forRep && need.status === 'Enviada' ? colors.warning : colors.border, padding: space.md, gap: space.sm }}
    >
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.label} numberOfLines={1}>
          {forRep ? doc.name : 'Tu solicitud'} · {ago(need.createdAt)}
        </Text>
        <View style={[styles.pill, { backgroundColor: st.bg }]}>
          <Text style={[styles.pillText, { color: st.fg }]}>{needLabel(need.status, forRep)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {need.keywords.map((k) => (
          <View key={k} style={[styles.pill, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="pricetag-outline" size={11} color={colors.primary} />
            <Text style={[styles.pillText, { color: colors.ink }]}>{k}</Text>
          </View>
        ))}
      </View>
      <Text style={type.caption} numberOfLines={2}>
        {forRep ? (matches.length ? `Coincide con tus productos: ${matches.map((m) => m.product.name).join(', ')} · ` : 'No coincide con tus productos · ') : ''}
        {need.urgency}
      </Text>
      {need.response ? (
        <Text style={[type.caption, { color: colors.success }]} numberOfLines={2}>
          Respuesta: {need.response}
        </Text>
      ) : null}
    </PressableScale>
  );
}

export const needUrgent = (n: ProductNeed) => n.urgency === 'Lo antes posible';
