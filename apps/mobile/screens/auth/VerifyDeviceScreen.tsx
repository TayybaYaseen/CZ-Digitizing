import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../../lib/api-client';
import { useAuth, type AuthTokens } from '../../lib/auth-context';
import { registerPushToken } from '../../lib/push-registration';
import type { AuthStackParamList } from '../../navigation/types';

// Port of apps/web/app/verify-device/page.tsx — POST /api/auth/verify-new-device {email, code}.
type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyDevice'>;

export function VerifyDeviceScreen({ route }: Props) {
  const { login } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const tokens = await apiFetch<AuthTokens>('/api/auth/verify-new-device', {
        method: 'POST',
        body: JSON.stringify({ email: route.params.email, code }),
      });
      await login(tokens);
      void registerPushToken(tokens.accessToken);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify this device</Text>
      <Text style={styles.subtitle}>We sent a code to {route.params.email}. Enter it below to continue.</Text>
      <TextInput style={styles.input} placeholder="Verification code" keyboardType="number-pad" value={code} onChangeText={setCode} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { marginBottom: 24, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12 },
});
