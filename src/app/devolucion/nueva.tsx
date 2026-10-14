import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { SubmitButton } from '@/components/SubmitButton';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Button, Card, Chip, EmptyState, Field, Screen, styles } from '@/components/ui';
import { Counter } from '@/components/visit';
import { DELIVERY_KINDS, productById, RETURN_REASONS, RETURN_WANTS, type ReturnSource, type ReturnWant } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

interface Received {
  key: string;
  source: ReturnSource;
  productId: string;
  material: string;
  max: number;
  when: number;
}

const shortDate = (t: number) => new Date(t).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' });

// Reporte de material recibido en mal estado (devolución o reposición)
export default function NuevaDevolucion() {
  const { userId, myVisits, myRequests, createReturn } = useMine();
  const me = userId ?? 'm1';

  // material que el médico recibió: entregas firmadas en visitas y material de apoyo de sus solicitudes
  const received = useMemo<Received[]>(() => {
    const out: Received[] = [];
    for (const v of myVisits) {
      if (v.doctorId !== me || !v.report?.endedAt) continue;
      const label = `Visita del ${shortDate(v.report.startedAt)}`;
      for (const [pid, d] of Object.entries(v.report.deliveries)) {
        for (const k of DELIVERY_KINDS) {
          const n = d[k.kind] ?? 0;
          if (k.kind === 'digital' || !n) continue;
          out.push({ key: `${v.id}-${pid}-${k.kind}`, source: { kind: 'visita', id: v.id, label }, productId: pid, material: k.label, max: n, when: v.report.startedAt });
        }
      }
    }
    for (const r of myRequests) {
      if (r.type !== 'Material de apoyo' || (r.status !== 'En proceso' && r.status !== 'Atendida')) continue;
      out.push({ key: `${r.id}`, source: { kind: 'solicitud', id: r.id, label: `Solicitud ${r.code}` }, productId: r.productId, material: 'Material de apoyo', max: 10, when: Date.now() - 2 * 864e5 });
    }
    return out.sort((a, b) => b.when - a.when);
  }, [myVisits, myRequests, me]);

  const [sel, setSel] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [want, setWant] = useState<ReturnWant>('Reposición');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoMsg, setPhotoMsg] = useState('');

  const item = received.find((r) => r.key === sel);
  const ready = !!item && !!reason && qty > 0;

  const pick = async (camera: boolean) => {
    setPhotoMsg('');
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setPhotoMsg('Sin permiso de cámara. Puedes elegir una foto de la galería.');
          return;
        }
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets[0]) setPhotos((p) => [...p, res.assets[0].uri].slice(0, 3));
    } catch {
      setPhotoMsg('No se pudo abrir la cámara en este dispositivo. Prueba con la galería.');
    }
  };


  return (
    <Screen
      header={<AppHeader title="Reportar material" subtitle="Devolución o reposición" />}
      footer={
        <SubmitButton
          label="Enviar reporte"
          icon="arrow-undo-outline"
          doneLabel="Reporte enviado"
          disabled={!ready}
          onSubmit={() => (item && reason ? createReturn({ source: item.source, productId: item.productId, material: item.material, qty, reason, detail: detail.trim(), want, photos }) : null)}
          onDone={(id) => id && router.replace({ pathname: '/devolucion/[id]', params: { id: String(id), nuevo: '1' } })}
        />
      }
    >
      <View style={[styles.demo, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={[type.caption, { color: colors.ink, flex: 1 }]}>
          Reporta muestras o material de apoyo que llegó en mal estado. No es una devolución de compra: el laboratorio lo revisa y lo repone o retira.
        </Text>
      </View>

      {/* 1. material */}
      <Step n={1} title="¿Qué material llegó mal?" />
      {received.length ? (
        <View style={{ gap: space.sm }}>
          {received.map((r) => {
            const p = productById(r.productId);
            if (!p) return null;
            const on = sel === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => {
                  setSel(r.key);
                  setQty(1);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${p.name}, ${r.material}, ${r.source.label}`}
                style={[styles.listItem, on && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft }]}
              >
                <View style={{ width: 46 }}>
                  <ProductVisual product={p} height={46} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{p.name}</Text>
                  <Text style={type.caption}>
                    {r.material}{r.source.kind === 'visita' ? ` · ${r.max} recibidos` : ''}
                  </Text>
                  <Text style={[type.caption, { color: colors.inkSubtle }]}>{r.source.label}</Text>
                </View>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.inkSubtle} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState icon="cube-outline" title="Aún no recibiste material" body="Aquí aparecerán las muestras entregadas en visitas firmadas y el material de apoyo de tus solicitudes." />
      )}

      {item ? (
        <>
          {/* 2. motivo */}
          <Step n={2} title="Motivo" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {RETURN_REASONS.map((r) => (
              <Chip key={r.label} label={r.label} icon={r.icon} selected={reason === r.label} onPress={() => setReason(r.label)} />
            ))}
          </View>

          {/* 3. cantidad */}
          <Step n={3} title="Cantidad afectada" />
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.label}>{item.material}</Text>
              <Text style={type.caption}>Máximo {item.max}</Text>
            </View>
            <Counter value={qty} max={item.max} label="unidades afectadas" onChange={(n) => setQty(Math.max(1, n))} />
          </Card>

          {/* 4. evidencia */}
          <Step n={4} title="Detalle y fotos" />
          <Field label="¿Qué pasó? (opcional)" value={detail} onChangeText={setDetail} placeholder="Ej.: la caja llegó aplastada y el tubo goteaba" multiline />
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {photos.map((u, i) => (
              <View key={u} style={{ width: 84, height: 84, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.border }}>
                <Image source={{ uri: u }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Foto ${i + 1}`} />
                <Pressable
                  onPress={() => setPhotos((p) => p.filter((x) => x !== u))}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar foto ${i + 1}`}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(32,52,58,0.75)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ))}
            {photos.length < 3 ? (
              <>
                {Platform.OS !== 'web' ? <PhotoButton icon="camera-outline" label="Cámara" onPress={() => pick(true)} /> : null}
                <PhotoButton icon="images-outline" label="Galería" onPress={() => pick(false)} />
              </>
            ) : null}
          </View>
          {photoMsg ? <Text style={[type.caption, { color: colors.warning }]}>{photoMsg}</Text> : <Text style={type.caption}>Hasta 3 fotos. Ayudan a resolver más rápido.</Text>}

          {/* 5. preferencia */}
          <Step n={5} title="¿Qué prefieres?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {RETURN_WANTS.map((w) => (
              <Chip key={w} label={w} selected={want === w} onPress={() => setWant(w)} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.row}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: font.bold, fontSize: 12, color: colors.white }}>{n}</Text>
      </View>
      <Text style={type.h3}>{title}</Text>
    </View>
  );
}

function PhotoButton({ icon, label, onPress }: { icon: 'camera-outline' | 'images-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Agregar foto desde ${label.toLowerCase()}`}
      style={({ pressed }) => ({ width: 84, height: 84, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={type.caption}>{label}</Text>
    </Pressable>
  );
}
