import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from '@/store/AppStore';
import { colors } from '@/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });

  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="auth/login" options={{ animation: 'fade', animationDuration: 450 }} />
          <Stack.Screen name="medico" options={{ animation: 'fade' }} />
          <Stack.Screen name="visitador" options={{ animation: 'fade' }} />
          <Stack.Screen name="presentacion/[id]" options={{ animation: 'fade_from_bottom', presentation: 'fullScreenModal' }} />
          <Stack.Screen name="visor/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
