import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './lib/auth-context';
import { LocaleProvider } from './lib/locale-context';
import { RootNavigator } from './navigation/RootNavigator';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md (aspect A-023) — app shell entry point.
// AuthProvider/LocaleProvider mirror apps/web's own provider nesting (lib/auth-context.tsx,
// lib/locale-context.tsx), SecureStore-backed instead of localStorage/cookies.
export default function App() {
  return (
    <SafeAreaProvider>
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
