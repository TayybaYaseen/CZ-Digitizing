import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 / AC-16 — "network-loss specifically shows
// a distinct 'You're offline' state per AC-16, not a generic error." Shared across every screen.
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => setIsOffline(state.isConnected === false));
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>You're offline. Some information may be out of date.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#7a1f1f', paddingVertical: 6, paddingHorizontal: 12 },
  text: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
