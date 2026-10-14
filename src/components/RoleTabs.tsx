import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { BubbleTabBar } from '@/components/BubbleTabBar';
import type { IconName, Role } from '@/data/mock';
import { useMine } from '@/store/AppStore';
import { colors, font } from '@/theme';

export interface TabDef {
  name: string;
  title: string;
  icon: IconName;
  iconOn: IconName;
  badge?: 'messages' | 'requests';
}

// Barra de navegación inferior por rol. Si no hay sesión del rol correcto, vuelve a la bienvenida.
export function RoleTabs({ role, tabs }: { role: Role; tabs: TabDef[] }) {
  const { role: current, unreadMessages, myRequests } = useMine();
  if (current !== role) return <Redirect href="/auth/login" />;
  const pending = myRequests.filter((r) => r.status === 'Pendiente').length;

  return (
    <Tabs
      tabBar={(props) => {
        const routes = props.state.routes;
        const items = routes.map((r) => {
          const t = tabs.find((x) => x.name === r.name);
          const count = t?.badge === 'messages' ? unreadMessages : t?.badge === 'requests' ? pending : 0;
          return { name: r.name, title: t?.title ?? r.name, icon: t?.icon ?? 'ellipse-outline', iconOn: t?.iconOn ?? 'ellipse', badge: count || undefined };
        });
        return (
          <BubbleTabBar
            tabs={items}
            index={props.state.index}
            onPress={(i) => {
              const route = routes[i];
              const ev = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!ev.defaultPrevented && props.state.index !== i) props.navigation.navigate(route.name);
            }}
          />
        );
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface, height: 64, paddingTop: 6 },
      }}
    >
      {tabs.map((t) => {
        const count = t.badge === 'messages' ? unreadMessages : t.badge === 'requests' ? pending : 0;
        return (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarBadge: count > 0 ? count : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.danger, fontFamily: font.bold, fontSize: 10 },
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons name={focused ? t.iconOn : t.icon} size={size - 2} color={color} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}
