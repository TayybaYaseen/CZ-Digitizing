import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import { useApiQuery } from '../../lib/use-api-query';
import { getErrorMessage } from '../../lib/errors';
import { OfflineBanner } from '../../components/OfflineBanner';
import type { AccountMemberDto } from '../../lib/types';

// Port of apps/web/app/account/members/page.tsx — GET/POST /api/users/account-members,
// DELETE /api/users/account-members/:id (aspect A-019 AC-7's minimal-viable reading: the invitee
// must already have their own registered login). Closes A-023's §5 Account Members gap.
export function MembersScreen() {
  const { accessToken } = useAuth();
  const query = useApiQuery<AccountMemberDto[]>('/api/users/account-members');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function invite() {
    if (!email.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/api/users/account-members', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: email.trim() }),
      });
      setEmail('');
      query.refetch();
    } catch (e) {
      setError(getErrorMessage(e, 'Could not add that member.'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/users/account-members/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      query.refetch();
    } catch (e) {
      setError(getErrorMessage(e, 'Could not remove that member.'));
    }
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <View style={styles.form}>
        <Text style={styles.hint}>Give someone else their own login to your order/quote/purchase history. They must already have their own registered account.</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.input}
            placeholder="colleague@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable style={styles.button} onPress={invite} disabled={busy || !email.trim()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Invite</Text>}
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {query.status === 'loading' && <ActivityIndicator style={styles.center} />}
      {query.status === 'error' && <Text style={styles.error}>Could not load your members.</Text>}
      {query.status === 'success' && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No members yet — invite a colleague above.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.displayName ?? item.email}</Text>
                <Text style={styles.rowEmail}>{item.email}</Text>
              </View>
              <Pressable onPress={() => revoke(item.id)}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  form: { padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  hint: { color: '#666', fontSize: 13, marginBottom: 12 },
  inviteRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', marginTop: 8 },
  empty: { padding: 24, textAlign: 'center', color: '#777' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  rowInfo: { flex: 1 },
  rowName: { fontWeight: '600' },
  rowEmail: { color: '#777', fontSize: 12, marginTop: 2 },
  remove: { color: '#c0392b', fontWeight: '600' },
});
