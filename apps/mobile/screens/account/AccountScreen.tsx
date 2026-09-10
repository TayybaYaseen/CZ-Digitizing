import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../lib/auth-context';
import { deregisterPushToken } from '../../lib/push-registration';
import type { AccountStackParamList } from '../../navigation/types';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md §5 Route(s): Account hub linking to Orders,
// Purchased Designs, Credits, Subscription, Notifications, Language selection — same sections as
// apps/web/app/account/page.tsx.
type Props = NativeStackScreenProps<AccountStackParamList, 'Account'>;

const LINKS: { label: string; route: keyof AccountStackParamList }[] = [
  { label: 'Orders', route: 'Orders' },
  { label: 'Purchased Designs', route: 'PurchasedDesigns' },
  { label: 'Credits', route: 'Credits' },
  { label: 'Subscription', route: 'Subscription' },
  { label: 'Notifications', route: 'Notifications' },
  { label: 'Language', route: 'LanguageSelect' },
];

export function AccountScreen({ navigation }: Props) {
  const { user, logout, accessToken } = useAuth();

  async function onLogout() {
    if (accessToken) await deregisterPushToken(accessToken);
    await logout();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{user?.email}</Text>
      {LINKS.map((link) => (
        <Pressable key={link.route} style={styles.row} onPress={() => navigation.navigate(link.route as never)}>
          <Text style={styles.rowLabel}>{link.label}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  email: { padding: 16, fontWeight: '600', fontSize: 16 },
  row: { padding: 16, borderTopWidth: 1, borderColor: '#eee' },
  rowLabel: { fontSize: 16 },
  logout: { padding: 16, marginTop: 24 },
  logoutText: { color: '#c0392b', fontWeight: '600', textAlign: 'center' },
});
