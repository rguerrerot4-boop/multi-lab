import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, LayoutAnimation, Platform, Pressable, ScrollView, Text, UIManager, View, useWindowDimensions } from 'react-native';
import { ProductVisual } from '@/components/ProductVisual';
import { ShareSheet } from '@/components/ShareSheet';
import {
  AppHeader,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  IconButton,
  ListItem,
  PressableScale,
  Screen,
  Segmented,
  SectionHeader,
  Tag,
  styles,
} from '@/components/ui';
import { products, productById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabKey = 'resumen' | 'uso' | 'precauciones' | 'recursos';
const VIEWS = ['Envase', 'Línea', 'Presentación'];

// Ficha interactiva de producto
export default function Producto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = productById(id);
  const { role, chatWith, logEvent } = useMine();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<TabKey>('resumen');
  const [view, setView] = useState(0);
  const [share, setShare] = useState(false);
  const [open, setOpen] = useState<string | null>('datos');
  const fade = useRef(new Animated.Value(1)).current;
  const gallery = useRef<ScrollView>(null);
  const galleryW = Math.min(width, 720) - space.lg * 2;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [tab, fade]);

  if (!p) {
    return (
      <Screen header={<AppHeader title="Producto" />}>
        <EmptyState icon="alert-circle-outline" title="Producto no encontrado" body="Es posible que ya no esté en el catálogo." />
      </Screen>
    );
  }

  const related = products.filter((x) => x.id !== p.id && (x.category === p.category || x.lab === p.lab)).slice(0, 3);
  const toggle = (k: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => (o === k ? null : k));
  };
  const goView = (i: number) => {
    setView(i);
    gallery.current?.scrollTo({ x: i * galleryW, animated: true });
  };

  return (
    <Screen
      header={
        <AppHeader
          title={p.name}
          subtitle={`${p.lab} · ${p.category}`}
          right={<IconButton icon="share-social-outline" label="Compartir ficha" onPress={() => setShare(true)} />}
        />
      }
      footer={
        role === 'medico' ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Contactar" variant="secondary" icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith('v1')}`)} />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button label="Solicitar" icon="add" onPress={() => router.push({ pathname: '/solicitud/nueva', params: { productId: p.id } })} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Compartir" variant="secondary" icon="send-outline" onPress={() => setShare(true)} />
            </View>
            <View style={{ flex: 1.3 }}>
              <Button label="Presentar" icon="play-circle-outline" onPress={() => router.push(`/presentacion/${p.id}`)} />
            </View>
          </View>
        )
      }
    >
      {/* Galería con vistas deslizables */}
      <View style={{ gap: space.sm }}>
        <ScrollView
          ref={gallery}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setView(Math.round(e.nativeEvent.contentOffset.x / galleryW))}
          style={{ borderRadius: radius.lg }}
        >
          {VIEWS.map((v, i) => (
            <View key={v} style={{ width: galleryW }}>
              <ProductVisual product={p} height={220} view={i} />
            </View>
          ))}
        </ScrollView>
        <View style={[styles.row, { justifyContent: 'center' }]}>
          {VIEWS.map((v, i) => (
            <Pressable
              key={v}
              onPress={() => goView(i)}
              accessibilityRole="button"
              accessibilityLabel={`Vista ${v}`}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radius.pill,
                backgroundColor: view === i ? colors.primary : colors.primarySoft,
              }}
            >
              <Text style={{ fontFamily: font.semibold, fontSize: 11, color: view === i ? colors.white : colors.primary }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={p.category} />
          {p.isNew ? <Tag label="Nuevo" tone="accent" /> : null}
        </View>
        <Text style={type.h1}>{p.name}</Text>
        <Text style={type.bodyMuted}>{p.tagline}</Text>
        <DemoNotice />
      </View>

      <Segmented
        value={tab}
        onChange={(t) => {
          setTab(t);
          logEvent('ficha_seccion', t);
        }}
        options={[
          { value: 'resumen', label: 'Resumen' },
          { value: 'uso', label: 'Uso' },
          { value: 'precauciones', label: 'Avisos' },
          { value: 'recursos', label: 'Recursos' },
        ]}
      />

      <Animated.View style={{ opacity: fade, gap: space.md }}>
        {tab === 'resumen' ? (
          <>
            <Text style={type.body}>{p.description}</Text>
            <Accordion title="Datos del producto" icon="information-circle-outline" open={open === 'datos'} onToggle={() => toggle('datos')}>
              <Info label="Laboratorio" value={`${p.lab} (ficticio)`} />
              <Info label="Presentación" value={p.form} />
              <Info label="Componente principal" value={p.component} />
              <Info label="Concentración" value={p.concentration} />
            </Accordion>
            <Accordion title="Usos descritos" icon="list-outline" open={open === 'usos'} onToggle={() => toggle('usos')}>
              {p.uses.map((u) => (
                <Bullet key={u} text={u} />
              ))}
              <Text style={type.caption}>Texto de ejemplo: no corresponde a indicaciones aprobadas.</Text>
            </Accordion>
          </>
        ) : null}

        {tab === 'uso' ? (
          <Card>
            <Text style={type.h3}>Modo de uso</Text>
            {p.howTo.map((step, i) => (
              <View key={step} style={[styles.row, { alignItems: 'flex-start' }]}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.white, fontFamily: font.bold, fontSize: 12 }}>{i + 1}</Text>
                </View>
                <Text style={[type.body, { flex: 1 }]}>{step}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {tab === 'precauciones' ? (
          <Card style={{ borderColor: colors.warningSoft }}>
            <View style={styles.row}>
              <Ionicons name="warning-outline" size={20} color={colors.warning} />
              <Text style={type.h3}>Advertencias y precauciones</Text>
            </View>
            {p.precautions.map((t) => (
              <Bullet key={t} text={t} />
            ))}
            <Text style={type.caption}>Información general de ejemplo. Consulte siempre la documentación oficial del producto.</Text>
          </Card>
        ) : null}

        {tab === 'recursos' ? (
          <View style={{ gap: space.sm }}>
            {p.docs.map((d) => (
              <ListItem
                key={d}
                icon={d.endsWith('.png') ? 'image-outline' : 'document-outline'}
                title={d}
                subtitle="Documento de demostración"
                onPress={() => Alert.alert('Documento de demostración', 'En una versión con servidor aquí se abriría el documento autorizado del laboratorio.')}
              />
            ))}
            <ListItem icon="albums-outline" title="Modo presentación" subtitle={`${p.slides.length} diapositivas interactivas`} onPress={() => router.push(`/presentacion/${p.id}`)} />
            <ListItem
              icon="cube-outline"
              title="Vista 3D"
              subtitle="Pendiente de integración con Vectary"
              right={<Tag label="Próximamente" />}
            />
          </View>
        ) : null}
      </Animated.View>

      {related.length ? (
        <>
          <SectionHeader title="Productos relacionados" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {related.map((r) => (
              <PressableScale key={r.id} onPress={() => router.replace(`/producto/${r.id}`)} style={{ width: 160 }} accessibilityLabel={`Ver ${r.name}`}>
                <ProductVisual product={r} height={100} />
                <Text style={[type.label, { marginTop: 6 }]} numberOfLines={1}>
                  {r.name}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </>
      ) : null}

      <ShareSheet product={p} visible={share} onClose={() => setShare(false)} />
    </Screen>
  );
}

function Accordion({ title, icon, open, onToggle, children }: { title: string; icon: 'information-circle-outline' | 'list-outline'; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[styles.row, { padding: space.lg }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={[type.h3, { flex: 1 }]}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkMuted} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>{children}</View> : null}
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2, paddingVertical: 4 }}>
      <Text style={type.caption}>{label}</Text>
      <Text style={type.body}>{value}</Text>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={[styles.row, { alignItems: 'flex-start' }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 8 }} />
      <Text style={[type.body, { flex: 1 }]}>{text}</Text>
    </View>
  );
}
