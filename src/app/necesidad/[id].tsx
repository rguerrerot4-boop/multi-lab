import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ago, DoctorStatusPill, needLabel } from '@/components/doctor';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, Button, Card, Chip, EmptyState, Field, Screen, styles } from '@/components/ui';
import { matchProducts, NEED_RESPONSES, personById, type NeedStatus } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

const STEPS: NeedStatus[] = ['Enviada', 'Vista', 'Atendida'];

// Búsqueda de producto por palabras clave: el visitador ve coincidencias y responde; el médico sigue el estado
export default function Necesidad() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { needs, role, markNeedSeen, respondNeed, doctorStatus, sendMessage, chatWith } = useMine();
  const need = needs.find((n) => n.id === id);
  const isRep = role === 'visitador';
  const [answer, setAnswer] = useState<string>(NEED_RESPONSES[0]);
  const [extra, setExtra] = useState('');
  const [shared, setShared] = useState<string[]>([]);

  useEffect(() => {
    if (isRep && need?.status === 'Enviada') markNeedSeen(need.id);
  }, [isRep, need?.id, need?.status, markNeedSeen]);

  if (!need) {
    return (
      <Screen header={<AppHeader title="Solicitud de producto" />}>
        <EmptyState icon="search-outline" title="No encontrada" body="" />
      </Screen>
    );
  }
  const doc = personById(need.doctorId);
  const rep = personById('v1');
  const matches = matchProducts(need.keywords);
  const step = STEPS.indexOf(need.status);
  const chatId = () => chatWith(isRep ? doc.id : rep.id);

  const share = (pid: string) => {
    const m = matches.find((x) => x.product.id === pid);
    sendMessage(chatId(), `Por su búsqueda “${need.keywords.join(', ')}”, le comparto ${m?.product.name}.`, pid);
    setShared((s) => [...s, pid]);
  };

  return (
    <Screen
      header={<AppHeader title={isRep ? 'Solicitud de producto' : 'Mi solicitud de producto'} subtitle={`${isRep ? doc.name : 'Publicada'} · ${ago(need.createdAt)}`} />}
      footer={
        isRep && need.status !== 'Atendida' ? (
          <Button
            label="Responder al médico"
            icon="send-outline"
            onPress={() => respondNeed(need.id, extra.trim() ? `${answer}. ${extra.trim()}` : answer)}
          />
        ) : undefined
      }
    >
      {/* quién y qué busca */}
      <Card>
        {isRep ? (
          <View style={styles.row}>
            <Avatar initials={doc.initials} tone="dark" size={48} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={type.h3}>{doc.name}</Text>
              <Text style={type.caption}>
                {doc.title} · {doc.city}
              </Text>
              <DoctorStatusPill status={doctorStatus[doc.id]} withTime />
            </View>
          </View>
        ) : null}
        <Text style={type.overline}>Palabras clave</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {need.keywords.map((k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Ionicons name="pricetag" size={12} color={colors.white} />
              <Text style={[type.label, { color: colors.white }]}>{k}</Text>
            </View>
          ))}
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={16} color={need.urgency === 'Lo antes posible' ? colors.danger : colors.inkMuted} />
          <Text style={[type.body, need.urgency === 'Lo antes posible' && { color: colors.danger }]}>{need.urgency}</Text>
        </View>
        {need.note ? <Text style={[type.bodyMuted, { fontStyle: 'italic' }]}>“{need.note}”</Text> : null}
      </Card>

      {/* estado */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : i <= step ? colors.primary : colors.border }} />
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= step ? colors.primary : colors.surface, borderWidth: 2, borderColor: i <= step ? colors.primary : colors.border }}>
                {i <= step ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < step ? colors.primary : colors.border }} />
            </View>
            <Text style={[type.caption, i <= step && { color: colors.ink }]}>{needLabel(s, isRep)}</Text>
          </View>
        ))}
      </View>

      {need.response ? (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <View style={styles.row}>
            <Avatar initials={rep.initials} size={32} />
            <Text style={[type.label, { flex: 1 }]}>Respuesta de {rep.name}</Text>
            {need.respondedAt ? <Text style={type.caption}>{ago(need.respondedAt)}</Text> : null}
          </View>
          <Text style={type.body}>{need.response}</Text>
          {!isRep ? <Button label="Abrir chat" small variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatId()}`)} /> : null}
        </Card>
      ) : null}

      {/* coincidencias: solo las ve el visitador */}
      {isRep ? (
      <>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={type.h2}>Coincide con tus productos</Text>
        <Text style={type.label}>{matches.length}</Text>
      </View>
      {matches.length ? (
        (
          <View style={{ gap: space.sm }}>
            {matches.map((m, i) => (
              <Card key={m.product.id} style={i === 0 ? { borderColor: colors.primary, borderWidth: 1.5 } : undefined}>
                <View style={styles.row}>
                  <View style={{ width: 56 }}>
                    <ProductVisual product={m.product} height={56} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    {i === 0 ? <Text style={type.overline}>Mejor coincidencia</Text> : null}
                    <Text style={type.h3}>{m.product.name}</Text>
                    <Text style={type.caption}>{m.product.tagline}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {m.hits.map((h) => (
                    <View key={h} style={[styles.pill, { backgroundColor: colors.successSoft }]}>
                      <Ionicons name="checkmark" size={12} color={colors.success} />
                      <Text style={[styles.pillText, { color: colors.success }]}>{h}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={shared.includes(m.product.id) ? 'Ficha enviada' : 'Enviar ficha'}
                      small
                      icon={shared.includes(m.product.id) ? 'checkmark' : 'send-outline'}
                      variant={shared.includes(m.product.id) ? 'ghost' : 'primary'}
                      onPress={() => !shared.includes(m.product.id) && share(m.product.id)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Ver ficha" small variant="secondary" icon="document-text-outline" onPress={() => router.push(`/producto/${m.product.id}`)} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )
      ) : (
        <Card>
          <Text style={type.bodyMuted}>Ninguno de tus productos coincide con estas palabras. Puedes responder igual para que el médico sepa que lo viste.</Text>
        </Card>
      )}
      </>
      ) : null}

      {isRep && need.status !== 'Atendida' ? (
        <>
          <Text style={type.h2}>Tu respuesta</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {NEED_RESPONSES.map((r) => (
              <Chip key={r} label={r} selected={answer === r} onPress={() => setAnswer(r)} />
            ))}
          </View>
          <Field label="Mensaje adicional (opcional)" value={extra} onChangeText={setExtra} placeholder="Ej.: paso el jueves por la tarde" multiline />
        </>
      ) : null}
      <Text style={[type.caption, { textAlign: 'center' }]}>Solicitud informativa con productos ficticios. No es un pedido ni una compra.</Text>
    </Screen>
  );
}
