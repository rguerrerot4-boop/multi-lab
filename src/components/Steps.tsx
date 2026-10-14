import { Text, View } from 'react-native';
import { colors, font, space, type } from '@/theme';

// Indicador de pasos para flujos (recuperación de acceso, solicitudes)
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }} accessibilityLabel={`Paso ${current + 1} de ${steps.length}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : done || on ? colors.primary : colors.border }} />
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done || on ? colors.primary : colors.surface,
                  borderWidth: 2,
                  borderColor: done || on ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: done || on ? colors.white : colors.inkMuted }}>
                  {done ? '✓' : i + 1}
                </Text>
              </View>
              <View style={{ flex: 1, height: 2, backgroundColor: i === steps.length - 1 ? 'transparent' : done ? colors.primary : colors.border }} />
            </View>
            <Text style={[type.caption, { textAlign: 'center', color: on ? colors.ink : colors.inkMuted, paddingHorizontal: space.xs }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export const RECOVERY_STEPS = ['Correo', 'Código', 'Nueva clave', 'Listo'];
