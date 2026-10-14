import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Avatar, BrandHeader, EmptyState, Screen, SectionHeader, styles } from '@/components/ui';
import { people, personById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, space, type } from '@/theme';

// Bandeja de conversaciones + búsqueda de contactos
export default function Mensajes() {
  const { role, userId, myChats, unreadNotices, chatWith } = useMine();
  const [q, setQ] = useState('');
  const otherRole = role === 'medico' ? 'visitador' : 'medico';

  const conversations = useMemo(
    () =>
      myChats
        .map((c) => {
          const other = personById(c.members.find((m) => m !== userId)!);
          const last = c.messages[c.messages.length - 1];
          return { c, other, last, unread: userId ? c.unreadFor[userId] ?? 0 : 0 };
        })
        .filter((x) => !q || x.other.name.toLowerCase().includes(q.toLowerCase())),
    [myChats, userId, q],
  );

  const contacts = people.filter(
    (p) => p.role === otherRole && !myChats.some((c) => c.members.includes(p.id)) && (!q || p.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Screen header={<BrandHeader unread={unreadNotices} onBell={() => router.push('/notificaciones')} />}>
      <Text style={type.h1}>Mensajes</Text>
      <View style={[styles.input, { borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.inkMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={role === 'medico' ? 'Buscar visitador' : 'Buscar profesional'}
          placeholderTextColor={colors.inkSubtle}
          style={styles.inputText}
          accessibilityLabel="Buscar contactos"
        />
      </View>

      {conversations.length === 0 && contacts.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="Sin conversaciones" body="No hay resultados para tu búsqueda." />
      ) : null}

      <View style={{ gap: space.sm }}>
        {conversations.map(({ c, other, last, unread }) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/chat/${c.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Conversación con ${other.name}${unread ? `, ${unread} sin leer` : ''}`}
            style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Avatar initials={other.initials} tone={other.role === 'medico' ? 'dark' : 'teal'} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
                  {other.name}
                </Text>
                <Text style={type.caption}>{last?.at ?? ''}</Text>
              </View>
              <Text style={type.caption} numberOfLines={1}>
                {other.org}
              </Text>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text
                  style={[type.bodyMuted, { flex: 1 }, unread ? { color: colors.ink, fontFamily: font.semibold } : null]}
                  numberOfLines={1}
                >
                  {last ? `${last.from === userId ? 'Tú: ' : ''}${last.productId ? '📄 Ficha compartida · ' : ''}${last.text}` : 'Sin mensajes todavía'}
                </Text>
                {unread ? (
                  <View style={{ backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                    <Text style={{ color: colors.white, fontFamily: font.bold, fontSize: 11 }}>{unread}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      {contacts.length ? (
        <>
          <SectionHeader title={role === 'medico' ? 'Otros visitadores' : 'Profesionales asignados'} />
          <View style={{ gap: space.sm }}>
            {contacts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/chat/${chatWith(p.id)}`)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.75 : 1 }]}
              >
                <Avatar initials={p.initials} tone="light" />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>{p.name}</Text>
                  <Text style={type.caption}>
                    {p.title} · {p.city}
                  </Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
