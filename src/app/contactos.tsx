import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AppHeader, Avatar, Button, Card, Screen, styles } from '@/components/ui';
import { people } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { space, type } from '@/theme';

// Contactos: el médico ve visitadores; el visitador ve profesionales asignados
export default function Contactos() {
  const { role, chatWith } = useMine();
  const list = people.filter((p) => p.role !== role);

  return (
    <Screen header={<AppHeader title={role === 'medico' ? 'Mis visitadores' : 'Profesionales asignados'} />}>
      {list.map((p) => (
        <Card key={p.id}>
          <View style={styles.row}>
            <Avatar initials={p.initials} tone={p.role === 'medico' ? 'dark' : 'teal'} />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{p.name}</Text>
              <Text style={type.caption}>{p.title}</Text>
              <Text style={type.caption}>
                {p.org} · {p.city}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button label="Mensaje" small icon="chatbubble-outline" onPress={() => router.push(`/chat/${chatWith(p.id)}`)} />
            </View>
            {role === 'visitador' ? (
              <View style={{ flex: 1 }}>
                <Button label="Agenda" small variant="secondary" icon="calendar-outline" onPress={() => router.push('/visitador/agenda')} />
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
