import { useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Montserrat_400Regular, Montserrat_600SemiBold } from '@expo-google-fonts/montserrat';
import { AuthProvider } from './lib/auth-context';
import { LocaleProvider } from './lib/locale-context';
import { RootNavigator } from './navigation/RootNavigator';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md (aspect A-023) — app shell entry point.
// AuthProvider/LocaleProvider mirror apps/web's own provider nesting (lib/auth-context.tsx,
// lib/locale-context.tsx), SecureStore-backed instead of localStorage/cookies.
SplashScreen.preventAutoHideAsync();

// Brand-kit fonts (lib/theme.ts's own `fonts` tokens name these same three family strings) — closes
// the "no font-loading package installed" gap flagged when the brand pass first touched this app's
// HomeScreen (SPEC_INDEX.md, A-001 2026-09-11 note): headings/prices previously fell back to
// Georgia/System instead of the real Playfair Display/Montserrat faces. The splash screen is kept up
// (preventAutoHideAsync above) until these resolve so no screen can flash the old fallback fonts.
export default function App() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Montserrat_400Regular,
    Montserrat_600SemiBold,
  });

  const onRootViewLayout = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onRootViewLayout}>
      <AuthProvider>
        <LocaleProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </LocaleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
