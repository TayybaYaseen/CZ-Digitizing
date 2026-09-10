import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PasswordInput } from '../../components/PasswordInput';
import { apiFetch } from '../../lib/api-client';
import { getErrorMessage } from '../../lib/errors';
import type { AdminStackParamList } from '../../navigation/types';

interface PendingTwoFactorResult {
  pendingTwoFactorToken: string;
  setupRequired: boolean;
}

// Port of apps/admin/app/login/page.tsx — AC-4/AC-2: mobile Admin Login, reachable only via this
// screen (never linked from customer navigation — see RootNavigator.tsx's own comment on where
// this stack is mounted). Admin login never returns tokens directly, always a partial session
// pending mandatory 2FA (architecture: "mandatory 2FA if role=admin").
type Props = NativeStackScreenProps<AdminStackParamList, 'AdminLogin'>;

export function AdminLoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<PendingTwoFactorResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      navigation.navigate('AdminTwoFactor', { challengeToken: result.pendingTwoFactorToken });
    } catch (e) {
      setError(getErrorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin sign in</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <PasswordInput dark placeholder="Password" value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0d0d1a' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24, color: '#fff' },
  input: { borderWidth: 1, borderColor: '#444', borderRadius: 8, padding: 12, marginBottom: 12, color: '#fff' },
  button: { backgroundColor: '#d4af37', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0d0d1a', fontWeight: '700' },
  error: { color: '#ff6b6b', marginBottom: 12 },
});
