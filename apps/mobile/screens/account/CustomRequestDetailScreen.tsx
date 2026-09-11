import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { io, type Socket } from 'socket.io-client';
import type { CustomRequestDto, CustomRequestFileDto, CustomRequestMessageDto } from '@czd/shared-types';
import { API_URL, ApiClientError, apiFetch } from '../../lib/api-client';
import { useAuth } from '../../lib/auth-context';
import type { AccountStackParamList } from '../../navigation/types';

// Port of apps/web/app/account/custom-requests/page.tsx's expanded-detail half, including AC-8's
// live message delivery + typing indicator over the custom-requests WebSocket gateway
// (apps/api/src/custom-requests/custom-requests.gateway.ts, namespace /custom-requests) — the
// first socket.io usage in apps/mobile. Same "wait for the server echo, don't optimistically
// append" pattern web uses (see handleMessage/onTyping below).
type Props = NativeStackScreenProps<AccountStackParamList, 'CustomRequestDetail'>;

export function CustomRequestDetailScreen({ route }: Props) {
  const { requestId } = route.params;
  const { accessToken } = useAuth();
  const [detail, setDetail] = useState<CustomRequestDto | null>(null);
  const [messages, setMessages] = useState<CustomRequestMessageDto[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        apiFetch<CustomRequestDto>(`/api/custom-requests/${requestId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        apiFetch<CustomRequestMessageDto[]>(`/api/custom-requests/${requestId}/messages`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      setDetail(d);
      setMessages(m);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not load this request.');
    }
  }, [requestId, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Connect only while this screen is focused — a stack screen underneath a pushed detail stays
  // mounted in React Navigation, so unmount alone isn't enough to guarantee disconnect on blur.
  useFocusEffect(
    useCallback(() => {
      const socket = io(`${API_URL}/custom-requests`, { auth: { token: accessToken }, transports: ['websocket'] });
      socket.on('connect', () => socket.emit('join', { customRequestId: requestId }));
      socket.on('message', (msg: CustomRequestMessageDto) => setMessages((prev) => [...prev, msg]));
      socket.on('typing', ({ isTyping }: { isTyping: boolean }) => setTyping(isTyping));
      socketRef.current = socket;
      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    }, [requestId, accessToken]),
  );

  function onTyping(value: string) {
    setChatInput(value);
    socketRef.current?.emit('typing', { customRequestId: requestId, isTyping: value.length > 0 });
  }

  function sendMessage() {
    if (!chatInput.trim()) return;
    socketRef.current?.emit('message', { customRequestId: requestId, message: chatInput });
    setChatInput('');
  }

  async function approve(paymentMethod: 'bank_transfer' | 'paypal') {
    setError(null);
    try {
      await apiFetch(`/api/custom-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ paymentMethod }),
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not approve the quote.');
    }
  }

  // No route in this codebase streams a file for a signed download token yet, for any file type
  // (see apps/web's own note on private-files.spec.ts) — this requests/confirms authorization
  // only, same honest gap web's own detail page has, not a mobile-specific limitation.
  async function download(file: CustomRequestFileDto) {
    try {
      await apiFetch<{ downloadUrl: string; expiresAt: string }>(`/api/custom-requests/${requestId}/files/${file.id}/download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not start the download.');
    }
  }

  if (error && !detail) return <View style={styles.container}><Text style={styles.error}>{error}</Text></View>;
  if (!detail) return <ActivityIndicator style={styles.center} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.requestNumber}>#{detail.requestNumber}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Machine format</Text>
        <Text>{detail.machineFormat}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Size</Text>
        <Text>{detail.sizeValue ?? '—'}</Text>
      </View>
      {detail.quotedPricePkr && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Quoted price</Text>
          <Text>PKR {detail.quotedPricePkr}</Text>
        </View>
      )}

      {detail.status === 'quote_sent' && (
        <View style={styles.quoteBox}>
          <Text style={styles.quoteText}>Quote: PKR {detail.quotedPricePkr} — approve to proceed</Text>
          <View style={styles.quoteActions}>
            <Pressable style={styles.button} onPress={() => approve('bank_transfer')}>
              <Text style={styles.buttonText}>Approve — Bank Transfer</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => approve('paypal')}>
              <Text style={styles.secondaryButtonText}>Approve — PayPal</Text>
            </Pressable>
          </View>
        </View>
      )}

      {detail.files.length > 0 && (
        <View style={styles.filesBox}>
          <Text style={styles.sectionTitle}>Delivered files</Text>
          <View style={styles.filesRow}>
            {detail.files.map((f) => (
              <Pressable key={f.id} style={styles.fileChip} onPress={() => download(f)}>
                <Text style={styles.fileChipText}>Download .{f.fileFormat}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.chatBox}>
        <Text style={styles.sectionTitle}>Messages</Text>
        {messages.map((m) => (
          <Text key={m.id} style={styles.chatMessage}>
            <Text style={styles.chatSender}>{m.senderRole === 'customer' ? 'You: ' : 'Admin: '}</Text>
            {m.message}
          </Text>
        ))}
        {messages.length === 0 && <Text style={styles.hint}>No messages yet.</Text>}
        {typing && <Text style={styles.typing}>Admin is typing…</Text>}
        <View style={styles.chatInputRow}>
          <TextInput style={styles.chatInput} placeholder="Add more info…" value={chatInput} onChangeText={onTyping} />
          <Pressable style={styles.chatSend} onPress={sendMessage}>
            <Text style={styles.chatSendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { marginTop: 40 },
  error: { color: '#c0392b', padding: 16, textAlign: 'center' },
  requestNumber: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#f2f2f2' },
  infoLabel: { color: '#777' },
  quoteBox: { backgroundColor: '#f7f7fa', borderRadius: 8, padding: 12, marginTop: 16 },
  quoteText: { fontWeight: '600', marginBottom: 8 },
  quoteActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  filesBox: { marginTop: 16 },
  filesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fileChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  fileChipText: { fontSize: 12 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  chatBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginTop: 16 },
  chatMessage: { marginBottom: 4 },
  chatSender: { fontWeight: '600' },
  hint: { color: '#999', fontSize: 12 },
  typing: { color: '#999', fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chatInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  chatSend: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  chatSendText: { fontSize: 13 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  secondaryButton: { borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  secondaryButtonText: { color: '#1a1a2e', fontWeight: '600', fontSize: 12 },
});
