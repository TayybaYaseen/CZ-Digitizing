import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/types';

// Port of apps/web/app/reset-password/page.tsx — POST /api/auth/reset-password {token, password}.
type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: route.params.token, password }) });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'That reset link is invalid or expired.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Password updated</Text>
        <Pressable style={styles.button} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <TextInput style={styles.input} placeholder="New password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset password</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12 },
});
