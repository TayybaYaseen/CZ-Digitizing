import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// expo-secure-store has NO web implementation — its own .web.ts module is a literal `export
// default {}` (verified in node_modules/expo-secure-store/src/ExpoSecureStore.web.ts), so every
// getItemAsync/setItemAsync/deleteItemAsync call silently no-ops (or throws, depending on call
// site) when this app runs via `expo start --web`. This is a documented Expo platform limitation,
// not a bug in this app's own code — SecureStore is genuinely native-only (iOS Keychain / Android
// Keystore). On native it stays the right choice for session tokens; on web, localStorage is the
// only persistent storage available, so every caller in this app goes through this module instead
// of importing expo-secure-store directly, to get the right backend per platform transparently.
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // best-effort — e.g. a private-browsing context that blocks localStorage
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {
      // best-effort
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
