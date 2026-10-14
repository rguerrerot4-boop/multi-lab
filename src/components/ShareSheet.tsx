import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { people, personById, type Product } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';
import { Avatar } from './ui';

// Hoja inferior para compartir una ficha de producto en un chat
export function ShareSheet({ product, visible, onClose }: { product: Product; visible: boolean; onClose: () => void }) {
  const { role, chatWith, sendMessage } = useMine();
  const targets = people.filter((p) => p.role !== role);

  const share = (personId: string) => {
    const chatId = chatWith(personId);
    onClose();
    // pequeño retraso para que exista el chat recién creado
    setTimeout(() => {
      sendMessage(chatId, `Te comparto la ficha de ${product.name}.`, product.id);
      router.push(`/chat/${chatId}`);
    }, 50);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, gap: space.md, paddingBottom: space.xxl }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        <Text style={type.h2}>Compartir ficha</Text>
        <Text style={type.bodyMuted}>{product.name} se enviará como tarjeta dentro del chat.</Text>
        {targets.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => share(p.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Avatar initials={personById(p.id).initials} size={40} tone="dark" />
            <View style={{ flex: 1 }}>
              <Text style={type.label}>{p.name}</Text>
              <Text style={type.caption}>{p.title}</Text>
            </View>
            <Ionicons name="send-outline" size={18} color={colors.primary} />
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
