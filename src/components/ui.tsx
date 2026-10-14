import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { IconName, RequestStatus } from '@/data/mock';
import { colors, font, radius, shadow, space, type } from '@/theme';

export const logoFull = require('../../assets/logo-full.png');
export const logoMark = require('../../assets/logo-mark.png');

// ---------- Contenedor de pantalla ----------
export function Screen({
  children,
  scroll = true,
  footer,
  header,
  contentStyle,
  bg = colors.bg,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bg?: string;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

// ---------- Cabeceras ----------
export function AppHeader({
  title,
  subtitle,
  back = true,
  right,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <IconButton icon="chevron-back" label="Volver" onPress={onBack ?? (() => goBack())} />
      ) : (
        <View style={{ width: 40 }} />
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {title ? (
          <Text style={[type.h3, { textAlign: 'center' }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <Image source={logoFull} style={{ width: 112, height: 29 }} resizeMode="contain" accessibilityLabel="Multi LAB" />
        )}
        {subtitle ? (
          <Text style={[type.caption, { textAlign: 'center' }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function BrandHeader({ unread, onBell }: { unread: number; onBell: () => void }) {
  return (
    <View style={[styles.header, { paddingHorizontal: space.lg }]}>
      <Image source={logoFull} style={{ width: 124, height: 32 }} resizeMode="contain" accessibilityLabel="Multi LAB" />
      <View style={{ flex: 1 }} />
      <View>
        <IconButton icon="notifications-outline" label="Notificaciones" onPress={onBell} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = colors.ink,
  bg = colors.surface,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  bg?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

// ---------- Interacción con escala (microinteracción) ----------
export function PressableScale({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  // las propiedades de tamaño se aplican al contenedor para que flex/width funcionen dentro de filas
  const flat = StyleSheet.flatten(style) ?? {};
  const outer = { flex: flat.flex, width: flat.width, alignSelf: flat.alignSelf };
  return (
    <Pressable
      style={outer}
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------- Botón ----------
// Micro-interacción: al presionar se hunde con rebote, sale una onda desde el dedo
// y el ícono se desliza un poco en la dirección de la acción.
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  disabled,
  loading,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
}) {
  const v = {
    primary: { bg: colors.primary, fg: colors.white, border: colors.primary, ripple: 'rgba(255,255,255,0.35)' },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary, ripple: 'rgba(30,127,140,0.18)' },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', ripple: 'rgba(30,127,140,0.14)' },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerSoft, ripple: 'rgba(179,38,30,0.14)' },
  }[variant];
  const off = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const nudge = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const [spot, setSpot] = useState({ x: 0, y: 0, size: 0 });
  const box = useRef({ w: 0, h: 0 });

  const pressIn = (e: { nativeEvent: { locationX?: number; locationY?: number } }) => {
    const { w, h } = box.current;
    const x = e.nativeEvent.locationX ?? w / 2;
    const y = e.nativeEvent.locationY ?? h / 2;
    const size = Math.max(w, h) * 2.4;
    setSpot({ x, y, size });
    ripple.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 0 }),
      Animated.timing(ripple, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(nudge, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 0 }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }),
      Animated.spring(nudge, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 12 }),
    ]).start();
  };

  const iconShift = nudge.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
  return (
    <Pressable
      onPress={onPress}
      onPressIn={off ? undefined : pressIn}
      onPressOut={off ? undefined : pressOut}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      accessibilityLabel={label}
    >
      <Animated.View
        onLayout={(e) => (box.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={[
          styles.btn,
          small && { minHeight: 40, paddingHorizontal: space.md },
          { backgroundColor: v.bg, borderColor: v.border, opacity: off ? 0.5 : 1, overflow: 'hidden', transform: [{ scale }] },
          variant === 'primary' && !off ? shadow.card : null,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spot.x - spot.size / 2,
            top: spot.y - spot.size / 2,
            width: spot.size,
            height: spot.size,
            borderRadius: spot.size / 2,
            backgroundColor: v.ripple,
            opacity: ripple.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] }),
            transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
          }}
        />
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            {icon ? (
              <Animated.View style={{ transform: [{ translateX: Animated.multiply(iconShift, -1) }] }}>
                <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} />
              </Animated.View>
            ) : null}
            <Text style={[styles.btnText, { color: v.fg, fontSize: small ? 13 : 15 }]}>{label}</Text>
            {iconRight ? (
              <Animated.View style={{ transform: [{ translateX: iconShift }] }}>
                <Ionicons name={iconRight} size={small ? 16 : 18} color={v.fg} />
              </Animated.View>
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ---------- Campo de formulario ----------
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secure,
  error,
  hint,
  keyboardType,
  multiline,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: IconName;
  secure?: boolean;
  error?: string;
  hint?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const [hidden, setHidden] = useState(true);
  const [focus, setFocus] = useState(false);
  const borderColor = error ? colors.danger : focus ? colors.primary : colors.border;
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.input, { borderColor }, multiline && { minHeight: 96, alignItems: 'flex-start', paddingTop: 12 }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.inkMuted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSubtle}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          multiline={multiline}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          accessibilityLabel={label}
          style={[styles.inputText, multiline && { textAlignVertical: 'top', minHeight: 72 }]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            hitSlop={8}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.row}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={[type.caption, { color: colors.danger, flex: 1 }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={type.caption}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ---------- Tarjetas y listas ----------
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginTop: space.sm }]}>
      <Text style={type.h2}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={[type.label, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  leading,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listItem, { opacity: pressed ? 0.75 : 1 }]}
    >
      {leading ??
        (icon ? (
          <View style={styles.iconTile}>
            <Ionicons name={icon} size={20} color={colors.primary} />
          </View>
        ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.h3} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.bodyMuted} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} /> : null)}
    </Pressable>
  );
}

export function Avatar({ initials, size = 44, tone = 'teal' }: { initials: string; size?: number; tone?: 'teal' | 'dark' | 'light' }) {
  const bg = tone === 'teal' ? colors.primary : tone === 'dark' ? colors.ink : colors.accentSoft;
  const fg = tone === 'light' ? colors.ink : colors.white;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.bold, color: fg, fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.white : colors.primary} /> : null}
      <Text style={[type.label, { color: selected ? colors.white : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; icon: IconName }> = {
  Pendiente: { bg: colors.warningSoft, fg: colors.warning, icon: 'time-outline' },
  Recibida: { bg: colors.primarySoft, fg: colors.primary, icon: 'mail-open-outline' },
  'En revisión': { bg: colors.primarySoft, fg: colors.primary, icon: 'search-outline' },
  'En proceso': { bg: colors.primarySoft, fg: colors.primary, icon: 'sync-outline' },
  Atendida: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle-outline' },
  Cancelada: { bg: colors.dangerSoft, fg: colors.danger, icon: 'close-circle-outline' },
  Programada: { bg: colors.primarySoft, fg: colors.primary, icon: 'calendar-outline' },
  'En curso': { bg: colors.accentSoft, fg: colors.ink, icon: 'play-circle-outline' },
  Realizada: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-done-outline' },
  Reprogramada: { bg: colors.warningSoft, fg: colors.warning, icon: 'swap-horizontal-outline' },
  Reportada: { bg: colors.warningSoft, fg: colors.warning, icon: 'alert-circle-outline' },
  'Retiro agendado': { bg: colors.primarySoft, fg: colors.primary, icon: 'calendar-outline' },
  Resuelta: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle-outline' },
};

export function StatusPill({ status }: { status: RequestStatus | string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.Pendiente;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Estado: ${status}`}>
      <Ionicons name={s.icon} size={13} color={s.fg} />
      <Text style={[styles.pillText, { color: s.fg }]}>{status}</Text>
    </View>
  );
}

const URGENCY_STYLE: Record<string, { bg: string; fg: string; icon: IconName }> = {
  Urgente: { bg: colors.dangerSoft, fg: colors.danger, icon: 'flash' },
  'Esta semana': { bg: colors.warningSoft, fg: colors.warning, icon: 'calendar-outline' },
  'Sin prisa': { bg: colors.primarySoft, fg: colors.primary, icon: 'time-outline' },
};

/** Nivel de necesidad de una solicitud (Urgente, Esta semana, Sin prisa) */
export function UrgencyPill({ urgency }: { urgency?: string }) {
  if (!urgency) return null;
  const s = URGENCY_STYLE[urgency] ?? URGENCY_STYLE['Sin prisa'];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]} accessibilityLabel={`Nivel de necesidad: ${urgency}`}>
      <Ionicons name={s.icon} size={12} color={s.fg} />
      <Text style={[styles.pillText, { color: s.fg }]}>{urgency}</Text>
    </View>
  );
}

export function Tag({ label, tone = 'soft' }: { label: string; tone?: 'soft' | 'accent' | 'dark' }) {
  const bg = tone === 'soft' ? colors.primarySoft : tone === 'accent' ? colors.turquesa : colors.ink;
  const fg = tone === 'dark' ? colors.white : colors.ink;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function DemoNotice({ text = 'Producto y datos ficticios · Prototipo académico' }: { text?: string }) {
  return (
    <View style={styles.demo}>
      <Ionicons name="flask-outline" size={14} color={colors.warning} />
      <Text style={[type.caption, { color: colors.warning, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <View style={[styles.iconTile, { width: 64, height: 64, borderRadius: 32 }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.bodyMuted, { textAlign: 'center' }]}>{body}</Text>
      {action}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segmentItem, on && styles.segmentOn]}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={on ? colors.primary : colors.inkMuted} /> : null}
            <Text style={[type.label, { color: on ? colors.primary : colors.inkMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.bg,
  },
  footer: {
    padding: space.lg,
    paddingBottom: space.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontFamily: font.bold, fontSize: 10 },
  btn: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  btnText: { fontFamily: font.semibold },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  inputText: { flex: 1, fontFamily: font.regular, fontSize: 15, color: colors.ink, paddingVertical: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillText: { fontFamily: font.semibold, fontSize: 12 },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
});
