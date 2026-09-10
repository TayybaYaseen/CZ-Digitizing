import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PasswordInput } from '../../components/PasswordInput';
import { ApiClientError, apiFetch } from '../../lib/api-client';
import { useAuth, type AuthUser } from '../../lib/auth-context';
import { getErrorMessage } from '../../lib/errors';
import { registerPushToken } from '../../lib/push-registration';
import type { AuthStackParamList } from '../../navigation/types';

// Port of apps/web/app/login/page.tsx — same POST /api/auth/login contract, same
// NEW_DEVICE_VERIFICATION_REQUIRED handling (routes to VerifyDevice instead of failing outright).
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  deviceId?: string;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<LoginResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await login(result);
      void registerPushToken(result.accessToken);
    } catch (e) {
      if (e instanceof ApiClientError) {
        if (e.error.code === 'NEW_DEVICE_VERIFICATION_REQUIRED') {
          navigation.navigate('VerifyDevice', { email });
          return;
        }
      }
      setError(getErrorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container} testID="login-screen">
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="login-email"
      />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} testID="login-password" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading} testID="login-submit">
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Create an account</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot password?</Text>
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
  link: { color: '#1a1a2e', marginTop: 16, textAlign: 'center' },
});
