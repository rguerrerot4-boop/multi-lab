import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  useFonts,
} from "@expo-google-fonts/montserrat";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WelcomeHost } from "@/components/WelcomeTransition";
import { AppProvider } from "@/store/AppStore";
import "@/data/vitrina"; // agrega las fotos del empaque a los productos que las tienen
import { colors } from "@/theme";

// En navegador: sin el resaltado gris/azul al tocar y sin contorno de foco al usar el dedo o el ratón
if (
  Platform.OS === "web" &&
  typeof document !== "undefined" &&
  !document.getElementById("ml-touch-css")
) {
  const st = document.createElement("style");
  st.id = "ml-touch-css";
  st.textContent =
    "*{-webkit-tap-highlight-color:transparent;}" +
    // la página no se desplaza ni rebota: solo se desplaza el contenido de cada pantalla
    "html,body{overscroll-behavior:none;}body{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;}" +
    "*:focus:not(:focus-visible){outline:none;}" +
    '[role="button"],[role="tab"],[role="radio"],[role="checkbox"]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}';
  document.head.appendChild(st);
}

// Solo para generar capturas de documentación (build web con EXPO_PUBLIC_CAPTURE=1)
if (
  Platform.OS === "web" &&
  process.env.EXPO_PUBLIC_CAPTURE === "1" &&
  typeof window !== "undefined"
) {
  (window as unknown as { __mlNav: (href: string) => void }).__mlNav = (href) =>
    router.push(href as never);
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.white,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" options={{ animation: "none" }} />
            <Stack.Screen
              name="auth/login"
              options={{ animation: "fade", animationDuration: 450 }}
            />
            <Stack.Screen name="medico" options={{ animation: "fade" }} />
            <Stack.Screen name="visitador" options={{ animation: "fade" }} />
            <Stack.Screen
              name="presentacion/[id]"
              options={{
                animation: "fade_from_bottom",
                presentation: "fullScreenModal",
              }}
            />
            <Stack.Screen
              name="visor/[id]"
              options={{ animation: "fade", presentation: "fullScreenModal" }}
            />
            <Stack.Screen
              name="ar/[id]"
              options={{
                animation: "fade_from_bottom",
                presentation: "fullScreenModal",
              }}
            />
          </Stack>
          <WelcomeHost />
        </View>
      </AppProvider>
    </SafeAreaProvider>
  );
}
