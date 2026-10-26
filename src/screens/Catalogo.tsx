import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlipCard } from '@/components/FlipCard';
import { VitrinaBanner } from '@/components/VitrinaBanner';
import { BrandHeader, Chip, EmptyState, styles } from '@/components/ui';
import { categories, labOfRep, products, repLabNames } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, space, type } from '@/theme';


// Catálogo multimedia interactivo (compartido por ambos roles)
export default function Catalogo() {
  const { role, userId, unreadNotices, logEvent } = useMine();
  const { width } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todos');
  const mine = repLabNames(userId ?? 'v1');
  const [grid, setGrid] = useState(true);
  const cols = grid ? (width >= 700 ? 3 : 2) : 1;

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === 'Todos' || p.category === cat) &&
        mine.includes(p.lab) &&
        (!term || `${p.name} ${p.tagline} ${p.category} ${p.lab}`.toLowerCase().includes(term)),
    ).sort((a, b) => Number(!!b.photo) - Number(!!a.photo)); // los productos con fotos 3D van primero
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat]);

  const open = (id: string) => {
    logEvent('ficha_abierta', id);
    router.push(`/producto/${id}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />
      <FlatList
        key={cols}
        data={list}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={cols > 1 ? { gap: space.md } : undefined}
        contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: space.xs }}>
            <View>
              <Text style={type.h1}>Catálogo</Text>
              <Text style={type.bodyMuted}>
                {role === 'visitador' ? 'Elige un producto para abrir su ficha o presentarlo.' : 'Explora productos y su información multimedia.'}
              </Text>
            </View>
            <VitrinaBanner />
            <View style={[styles.input, { borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.inkMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Buscar por nombre o categoría"
                placeholderTextColor={colors.inkSubtle}
                style={styles.inputText}
                accessibilityLabel="Buscar productos"
                returnKeyType="search"
              />
              {q ? (
                <Pressable onPress={() => setQ('')} accessibilityLabel="Borrar búsqueda" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.inkSubtle} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {categories.map((c) => (
                <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} />
              ))}
            </ScrollView>
            {/* solo los productos del laboratorio del visitador (Celvia) y CORAESSENS, que se muestra con permiso */}
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={[type.caption, { flex: 1 }]}>
                {list.length} {list.length === 1 ? 'producto' : 'productos'} · {labOfRep(userId ?? 'v1')?.full ?? 'Laboratorios Celvia'} (ficticio) y CORAESSENS (real, con permiso)
              </Text>
              <Pressable
                onPress={() => setGrid((g) => !g)}
                accessibilityRole="button"
                accessibilityLabel={grid ? 'Ver como lista' : 'Ver como cuadrícula'}
                hitSlop={8}
                style={{ padding: 6 }}
              >
                <Ionicons name={grid ? 'list-outline' : 'grid-outline'} size={20} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1 / cols }}>
            <FlipCard
              product={item}
              onOpen={() => open(item.id)}
              actionLabel={role === 'visitador' ? 'Presentar' : 'Solicitar'}
              actionIcon={role === 'visitador' ? 'play-circle-outline' : 'add-circle-outline'}
              onAction={() =>
                role === 'visitador'
                  ? router.push(`/presentacion/${item.id}`)
                  : router.push({ pathname: '/solicitud/nueva', params: { productId: item.id } })
              }
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="Sin resultados"
            body="No encontramos productos con esos filtros. Prueba con otro nombre o categoría."
            action={
              <Pressable
                onPress={() => {
                  setQ('');
                  setCat('Todos');
                }}
                accessibilityRole="button"
              >
                <Text style={[type.label, { color: colors.primary }]}>Limpiar filtros</Text>
              </Pressable>
            }
          />
        }
      />
    </SafeAreaView>
  );
}
