import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { Steps } from '@/components/Steps';
import { AppHeader, Avatar, Button, Card, DemoNotice, Field, Screen, styles } from '@/components/ui';
import { personById, products, productById, type RequestType } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

const TYPES: { value: RequestType; desc: string; icon: 'document-text-outline' | 'folder-open-outline' | 'calendar-outline' }[] = [
  { value: 'Información técnica', desc: 'Ficha técnica, estudios o documentación autorizada.', icon: 'document-text-outline' },
  { value: 'Material de apoyo', desc: 'Material informativo autorizado por el laboratorio.', icon: 'folder-open-outline' },
  { value: 'Agendar visita', desc: 'Pedir que el visitador presente el producto.', icon: 'calendar-outline' },
];

// Flujo: elegir producto → tipo y detalle → confirmar
export default function NuevaSolicitud() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { createRequest } = useMine();
  const [step, setStep] = useState(productId ? 1 : 0);
  const [pid, setPid] = useState(productId ?? '');
  const [kind, setKind] = useState<RequestType | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const p = productById(pid);
  const rep = personById('v1');

  const next = () => {
    if (step === 0 && !pid) return setError('Selecciona un producto.');
    if (step === 1 && !kind) return setError('Elige el tipo de solicitud.');
    setError(undefined);
    if (step < 2) setStep(step + 1);
    else {
      const id = createRequest({ productId: pid, type: kind!, notes });
      router.replace({ pathname: '/solicitud/[id]', params: { id, nueva: '1' } });
    }
  };

  return (
    <Screen
      header={<AppHeader title="Nueva solicitud" onBack={() => (step > (productId ? 1 : 0) ? setStep(step - 1) : router.back())} />}
      footer={
        <>
          {error ? <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>{error}</Text> : null}
          <Button label={step < 2 ? 'Continuar' : 'Enviar solicitud'} iconRight={step < 2 ? 'arrow-forward' : 'send'} onPress={next} />
        </>
      }
    >
      <Steps steps={['Producto', 'Detalle', 'Confirmar']} current={step} />

      {step === 0 ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.h2}>¿Sobre qué producto?</Text>
          {products.map((x) => {
            const on = x.id === pid;
            return (
              <Pressable
                key={x.id}
                onPress={() => setPid(x.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.listItem, on && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              >
                <View style={{ width: 56 }}>
                  <ProductVisual product={x} height={56} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{x.name}</Text>
                  <Text style={type.caption}>
                    {x.category} · {x.lab}
                  </Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={colors.primary} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {step === 1 ? (
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
          <Field label="Comentario (opcional)" value={notes} onChangeText={setNotes} placeholder="Agrega detalles para el visitador" multiline />
          <DemoNotice text="Las solicitudes no incluyen venta ni dispensación de medicamentos." />
        </View>
      ) : null}

      {step === 2 && p ? (
        <View style={{ gap: space.md }}>
          <Text style={type.h2}>Revisa tu solicitud</Text>
          <Card>
            <View style={styles.row}>
              <View style={{ width: 64 }}>
                <ProductVisual product={p} height={64} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{p.name}</Text>
                <Text style={type.caption}>{p.lab} (ficticio)</Text>
              </View>
            </View>
            <Row label="Tipo" value={kind ?? ''} />
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
