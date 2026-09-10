import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../../lib/api-client';
import { useAuth, type AuthTokens } from '../../lib/auth-context';
import type { AdminStackParamList } from '../../navigation/types';

// Port of apps/admin/app/login/2fa/page.tsx's verify path (this pass covers an already-enrolled
// admin's `verify-2fa`; first-time TOTP-secret setup/QR enrollment is a desktop-admin-onboarding
// flow, deferred alongside this pass's other deferred screens — an admin's first 2FA enrollment
// happens once, on the existing apps/admin web console).
type Props = NativeStackScreenProps<AdminStackParamList, 'AdminTwoFactor'>;

export function AdminTwoFactorScreen({ route, navigation }: Props) {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const tokens = await apiFetch<AuthTokens>('/api/auth/verify-2fa', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: { Authorization: `Bearer ${route.params.challengeToken}` },
      });
      await login(tokens);
      navigation.replace('AdminDashboard');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Invalid code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Two-factor verification</Text>
      <TextInput style={styles.input} placeholder="6-digit code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0d0d1a' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, color: '#fff' },
  input: { borderWidth: 1, borderColor: '#444', borderRadius: 8, padding: 12, marginBottom: 12, color: '#fff' },
  button: { backgroundColor: '#d4af37', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0d0d1a', fontWeight: '700' },
  error: { color: '#ff6b6b', marginBottom: 12 },
});
