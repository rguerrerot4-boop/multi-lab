import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlipCard } from '@/components/FlipCard';
import { Destacados } from '@/components/VitrinaBanner';
import { BrandHeader, Chip, EmptyState, styles } from '@/components/ui';
import { categories, normalize, products, repLabNames } from '@/data/mock';
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
    // busca por nombre, laboratorio, categoría, componentes y palabras clave (sin tildes ni mayúsculas); todas las palabras deben coincidir
    const words = normalize(q).split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      if ((cat !== 'Todos' && p.category !== cat) || !mine.includes(p.lab)) return false;
      if (!words.length) return true;
      const text = normalize([p.name, p.lab, p.category, p.tagline, p.form, p.component, p.description, ...p.uses, ...(p.keywords ?? [])].join(' '));
      // las palabras cortas («d», «b6»…) cuentan solo como palabra completa, así «vitamina d» no trae cualquier vitamina
      return words.every((w) => (w.length > 2 ? text.includes(w) : ` ${text.replace(/[^a-z0-9]+/g, ' ')} `.includes(` ${w} `)));
    }).sort((a, b) => Number(!!(b.photo || b.bottle)) - Number(!!(a.photo || a.bottle))); // los productos con fotos 3D van primero
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
            <Destacados />
            <View style={[styles.input, { borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.inkMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Buscar: nombre, componente o palabra clave"
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
            {/* solo los 5 productos reales, mostrados con permiso de Nutrabiotics y Procaps */}
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={[type.caption, { flex: 1 }]}>
                {list.length} {list.length === 1 ? 'producto' : 'productos'} · Nutrabiotics y Procaps · productos reales, con permiso del laboratorio
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
