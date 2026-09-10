import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../../lib/api-client';
import type { AuthStackParamList } from '../../navigation/types';

// Port of apps/web/app/verify-email/page.tsx — GET /api/auth/verify-email?token=...
type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

export function VerifyEmailScreen({ route }: Props) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = route.params?.token;
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    apiFetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error');
        setMessage(e instanceof ApiClientError ? e.error.message : 'This verification link is invalid or expired.');
      });
  }, [route.params?.token]);

  return (
    <View style={styles.container}>
      {status === 'loading' && <ActivityIndicator />}
      {status === 'success' && <Text style={styles.title}>Email verified. You can now sign in.</Text>}
      {status === 'error' && <Text style={styles.error}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  error: { color: '#c0392b', textAlign: 'center' },
});
