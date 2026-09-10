import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PasswordInput } from '../../components/PasswordInput';
import { apiFetch } from '../../lib/api-client';
import { getErrorMessage } from '../../lib/errors';
import type { AuthStackParamList } from '../../navigation/types';

// Port of apps/web/app/register/page.tsx — POST /api/auth/register, then routes to sign-in.
type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName: displayName || undefined }),
      });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  // Port of the link apps/web's verify-email page opens — but apps/mobile has no deep-link
  // handler to catch that link from the email app, so it verifies via the emailed 4-digit code
  // instead (POST /api/auth/verify-email-code, aspect A-023 — same account either way).
  async function onVerifyCode() {
    setCodeError(null);
    setVerifying(true);
    try {
      await apiFetch('/api/auth/verify-email-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      setVerified(true);
    } catch (e) {
      setCodeError(getErrorMessage(e, 'Invalid or expired code.'));
    } finally {
      setVerifying(false);
    }
  }

  if (success) {
    if (verified) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Email verified</Text>
          <Text>Your account is ready — sign in to continue.</Text>
          <Pressable style={styles.button} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.buttonText}>Sign in</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a verification code to {email}. Enter it below to continue.</Text>
        <TextInput
          style={styles.input}
          placeholder="Verification code"
          keyboardType="number-pad"
          maxLength={4}
          value={code}
          onChangeText={setCode}
        />
        {codeError ? <Text style={styles.error}>{codeError}</Text> : null}
        <Pressable style={styles.button} onPress={onVerifyCode} disabled={verifying}>
          {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Back to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <TextInput style={styles.input} placeholder="Display name (optional)" value={displayName} onChangeText={setDisplayName} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <PasswordInput placeholder="Password" value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create account</Text>}
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  subtitle: { marginBottom: 24, color: '#555' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12 },
  link: { color: '#1a1a2e', marginTop: 16, textAlign: 'center' },
});
