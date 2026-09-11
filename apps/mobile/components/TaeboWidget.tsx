import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TaeboReplyDto, TaeboSuggestionDto } from '@czd/shared-types';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

// Port of apps/web/components/TaeboWidget.tsx (aspect A-020) — floating chat widget, mounted once
// over CustomerTabs (mirrors web's once-in-layout.tsx mounting). Despite the "WebSocket-like
// polling" phrasing in some docs, Taebo itself is plain request/response REST (POST
// /api/taebo/chat, GET /api/taebo/suggestions) — no socket needed here, unlike Custom Requests.
// RN has no sessionStorage, so sessionId/greeted-once live in a ref for the lifetime of one app
// launch instead — the closer equivalent to web's own per-tab-session semantics, not a downgrade.
const IDLE_MS = 30000;

interface DisplayMessage {
  id: string;
  sender: 'customer' | 'taebo';
  text: string;
  escalated?: boolean;
}

export function TaeboWidget() {
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([{ id: 'greeting', sender: 'taebo', text: "Hi, I'm Taebo! 🐼 Ask me anything, or open chat any time you need help." }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TaeboSuggestionDto[]>([]);
  const [proactiveOffer, setProactiveOffer] = useState<TaeboSuggestionDto | null>(null);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);

  const sessionIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch<{ whatsappNumber: string | null }>('/api/settings/public')
      .then((s) => setWhatsappHref(s.whatsappNumber ? `https://wa.me/${s.whatsappNumber.replace(/[^\d]/g, '')}` : null))
      .catch(() => setWhatsappHref(null));
    apiFetch<TaeboSuggestionDto[]>('/api/taebo/suggestions')
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, []);

  // AC-9 — proactive suggestion after an idle threshold, without requiring the customer to open
  // chat first.
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setProactiveOffer(null);
    if (open) return;
    idleTimerRef.current = setTimeout(() => {
      apiFetch<TaeboSuggestionDto[]>('/api/taebo/suggestions')
        .then((rows) => {
          if (rows[0]) setProactiveOffer(rows[0]);
        })
        .catch(() => undefined);
    }, IDLE_MS);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(false);
    setInput('');
    setProactiveOffer(null);
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'customer', text: trimmed }]);
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const reply = await apiFetch<TaeboReplyDto>('/api/taebo/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: trimmed, conversationId, sessionId: sessionIdRef.current, page: null }),
      });
      setConversationId(reply.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `reply-${Date.now()}`,
          sender: 'taebo',
          text: reply.escalated ? "I've passed this to our team — you'll hear back soon." : (reply.answer ?? ''),
          escalated: reply.escalated,
        },
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && proactiveOffer && (
        <Pressable
          style={styles.proactiveBubble}
          onPress={() => {
            setOpen(true);
            void send(proactiveOffer.question);
          }}
        >
          <Text style={styles.proactiveText}>Need help with {proactiveOffer.question}?</Text>
        </Pressable>
      )}

      {!open && (
        <Pressable style={styles.fab} onPress={() => setOpen(true)} accessibilityLabel="Open Taebo chat">
          <Text style={styles.fabEmoji}>🐼</Text>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.headerText}>Taebo Helping Panda 🐼</Text>
              <Pressable onPress={() => setOpen(false)} accessibilityLabel="Close chat">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
              {messages.length === 1 && suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  <Text style={styles.suggestionsLabel}>Common questions:</Text>
                  {suggestions.map((s) => (
                    <Pressable key={s.faqId} style={styles.suggestionRow} onPress={() => void send(s.question)}>
                      <Text style={styles.suggestionText}>{s.question}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {messages.map((m) => (
                <View key={m.id} style={m.sender === 'customer' ? styles.bubbleRowRight : styles.bubbleRowLeft}>
                  <Text style={[styles.bubble, m.sender === 'customer' ? styles.bubbleCustomer : m.escalated ? styles.bubbleEscalated : styles.bubbleTaebo]}>
                    {m.text}
                  </Text>
                </View>
              ))}
              {loading && <Text style={styles.typing}>Taebo is typing…</Text>}
              {error && (
                <View style={styles.errorRow}>
                  <Text style={styles.errorText}>Something went wrong.</Text>
                  <Pressable onPress={() => void send(input || messages.at(-2)?.text || '')}>
                    <Text style={styles.retry}>Retry</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            <View style={styles.inputBar}>
              {whatsappHref && (
                <Pressable onPress={() => Linking.openURL(whatsappHref)}>
                  <Text style={styles.whatsapp}>Prefer WhatsApp? Chat with our team</Text>
                </Pressable>
              )}
              <View style={styles.inputRow}>
                <TextInput style={styles.input} placeholder="Ask Taebo a question…" value={input} onChangeText={setInput} onSubmitEditing={() => void send(input)} />
                <Pressable style={styles.sendButton} onPress={() => void send(input)} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sendText}>Send</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 16, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  fabEmoji: { fontSize: 28 },
  proactiveBubble: { position: 'absolute', right: 16, bottom: 88, maxWidth: 220, backgroundColor: '#fff', borderRadius: 10, padding: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  proactiveText: { fontSize: 13, color: '#1a1a2e' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  panel: { height: '70%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', paddingVertical: 12, paddingHorizontal: 16 },
  headerText: { color: '#fff', fontWeight: '600' },
  close: { color: '#fff', fontSize: 16 },
  messages: { flex: 1 },
  messagesContent: { padding: 12 },
  suggestions: { marginBottom: 8 },
  suggestionsLabel: { fontSize: 12, color: '#777', marginBottom: 4 },
  suggestionRow: { backgroundColor: '#f2f2f7', borderRadius: 6, padding: 8, marginBottom: 6 },
  suggestionText: { fontSize: 13 },
  bubbleRowLeft: { alignItems: 'flex-start', marginBottom: 8 },
  bubbleRowRight: { alignItems: 'flex-end', marginBottom: 8 },
  bubble: { maxWidth: '85%', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, overflow: 'hidden' },
  bubbleCustomer: { backgroundColor: '#1a1a2e', color: '#fff' },
  bubbleTaebo: { backgroundColor: '#f2f2f7', color: '#1a1a2e' },
  bubbleEscalated: { backgroundColor: '#fff3cd', color: '#7a5b00' },
  typing: { fontSize: 12, color: '#999' },
  errorRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fdecea', borderRadius: 6, padding: 8 },
  errorText: { color: '#c0392b', fontSize: 12 },
  retry: { color: '#c0392b', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  inputBar: { borderTopWidth: 1, borderColor: '#eee', padding: 10 },
  whatsapp: { color: '#1e7e34', fontSize: 12, textAlign: 'center', marginBottom: 8, textDecorationLine: 'underline' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  sendButton: { backgroundColor: '#1a1a2e', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  sendText: { color: '#fff', fontWeight: '600' },
});
