import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoctorStatusPill } from '@/components/doctor';
import { Avatar, Button, Chip, styles } from '@/components/ui';
import { people, personById } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, radius, space, type } from '@/theme';

/** Hoja para elegir con quién empezar la visita: las de hoy o una sin cita */
export function StartVisitSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { myVisits, startVisit, addUnscheduledVisit, doctorStatus } = useMine();
  const insets = useSafeAreaInsets();
  const today = myVisits
    .filter((v) => v.dayOffset === 0 && v.status !== 'Realizada')
    .sort((a, b) => a.time.localeCompare(b.time));
  const [sel, setSel] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSel(today[0]?.id ?? null);
      setWalkIn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const go = () => {
    let id = selVisit?.id ?? null;
    if (walkIn) id = addUnscheduledVisit(walkIn);
    if (!id) return;
    startVisit(id);
    onClose();
    router.push(`/en-visita/${id}`);
  };

  const doctors = people.filter((p) => p.role === 'medico');
  const selVisit = today.find((v) => v.id === sel);
  const target = walkIn ? personById(walkIn) : selVisit ? personById(selVisit.doctorId) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '86%', paddingBottom: insets.bottom + space.lg }}>
        <View style={{ alignItems: 'center', paddingTop: space.sm }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          <Text style={type.h2}>Comenzar visita</Text>
          <Text style={type.bodyMuted}>Elige al profesional que estás visitando.</Text>

          <Text style={type.overline}>Agendadas para hoy</Text>
          {today.length ? (
            today.map((v) => {
              const d = personById(v.doctorId);
              const on = sel === v.id && !walkIn;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    setSel(v.id);
                    setWalkIn(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${d.name}, ${v.time}`}
                  style={[styles.listItem, on && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft }]}
                >
                  <Avatar initials={d.initials} size={42} tone="dark" />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>{d.name}</Text>
                    <Text style={type.caption} numberOfLines={1}>
                      {v.time} · {v.place}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <DoctorStatusPill status={doctorStatus[d.id]} />
                    </View>
                  </View>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.inkSubtle} />
                </Pressable>
              );
            })
          ) : (
            <Text style={type.bodyMuted}>No te quedan visitas agendadas hoy.</Text>
          )}

          <Text style={type.overline}>Visita sin cita</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {doctors.map((d) => (
              <Chip key={d.id} label={d.name} icon="person-add-outline" selected={walkIn === d.id} onPress={() => setWalkIn(walkIn === d.id ? null : d.id)} />
            ))}
          </View>

          <Button label={target ? `Comenzar con ${target.name}` : 'Elige un profesional'} icon="play" disabled={!target} onPress={go} />
        </ScrollView>
      </View>
    </Modal>
  );
}
