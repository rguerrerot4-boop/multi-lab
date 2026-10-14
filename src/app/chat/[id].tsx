import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductVisual } from '@/components/ProductVisual';
import { AppHeader, Avatar, EmptyState, styles } from '@/components/ui';
import { personById, productById, products } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font, radius, space, type } from '@/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { chats, userId, sendMessage, markChatRead } = useMine();
  const chat = chats.find((c) => c.id === id);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const list = useRef<FlatList>(null);

  useEffect(() => {
    if (chat) markChatRead(chat.id);
  }, [chat?.id, chat?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chat || !userId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppHeader title="Chat" />
        <EmptyState icon="chatbubbles-outline" title="Abriendo conversación…" body="" />
      </SafeAreaView>
    );
  }

  const other = personById(chat.members.find((m) => m !== userId)!);
  const send = () => {
    if (!text.trim()) return;
    sendMessage(chat.id, text.trim());
    setText('');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right', 'bottom']}>
      <AppHeader
        title={other.name}
        subtitle={other.org}
        right={<Avatar initials={other.initials} size={36} tone={other.role === 'medico' ? 'dark' : 'teal'} />}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={chat.messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-ellipses-outline" title="Inicia la conversación" body={`Escribe a ${other.name} o comparte la ficha de un producto.`} />
          }
          ListHeaderComponent={
            chat.messages.length ? (
              <Text style={[type.caption, { textAlign: 'center', marginBottom: space.sm }]}>
                Los mensajes se responden según la disponibilidad de cada profesional.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = item.from === userId;
            const prod = item.productId ? productById(item.productId) : undefined;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View
                  style={{
                    maxWidth: '82%',
                    backgroundColor: mine ? colors.primary : colors.surface,
                    borderRadius: radius.lg,
                    borderBottomRightRadius: mine ? 4 : radius.lg,
                    borderBottomLeftRadius: mine ? radius.lg : 4,
                    padding: space.md,
                    gap: space.sm,
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  {prod ? (
                    <Pressable
                      onPress={() => router.push(`/producto/${prod.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ficha de ${prod.name}`}
                      style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', width: 220 }}
                    >
                      <ProductVisual product={prod} height={90} />
                      <View style={{ padding: space.sm }}>
                        <Text style={type.label}>{prod.name}</Text>
                        <Text style={[type.caption, { color: colors.primary }]}>Ver ficha →</Text>
                      </View>
                    </Pressable>
                  ) : null}
                  <Text style={{ fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: mine ? colors.white : colors.ink }}>{item.text}</Text>
                  <Text style={{ fontFamily: font.medium, fontSize: 10, color: mine ? '#CFEAEE' : colors.inkSubtle, alignSelf: 'flex-end' }}>{item.at}</Text>
                </View>
              </View>
            );
          }}
        />
        <View style={[styles.row, { padding: space.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }]}>
          <Pressable onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel="Compartir ficha de producto" hitSlop={6}>
            <Ionicons name="attach" size={24} color={colors.primary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje"
            placeholderTextColor={colors.inkSubtle}
            style={[styles.inputText, { backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: space.md }]}
            onSubmitEditing={send}
            returnKeyType="send"
            accessibilityLabel="Mensaje"
          />
          <Pressable
            onPress={send}
            disabled={!text.trim()}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: text.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={() => setPicker(false)} />
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, gap: space.sm, paddingBottom: space.xxl }}>
          <Text style={type.h2}>Compartir ficha</Text>
          {products.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                sendMessage(chat.id, `Te comparto la ficha de ${p.name}.`, p.id);
                setPicker(false);
              }}
              style={[styles.row, { paddingVertical: 6 }]}
              accessibilityRole="button"
            >
              <View style={{ width: 48 }}>
                <ProductVisual product={p} height={48} />
              </View>
              <Text style={[type.label, { flex: 1 }]}>{p.name}</Text>
              <Ionicons name="send-outline" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
