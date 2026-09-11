import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuoteDto, QuoteMessageDto, QuoteQuestionDto } from '@czd/shared-types';
import { ApiClientError, apiFetch } from '../lib/api-client';
import type { MainServiceDto, ServiceSummaryDto } from '../lib/types';
import type { MoreStackParamList } from '../navigation/types';

// Port of apps/web/app/get-a-quote/page.tsx — the guided 3-step quote flow (aspect A-016
// AC-1-AC-9), kept as one screen with local step state exactly like the web page, since the
// quote id + access token (x-quote-access-token — quotes support anonymous submission on web, so
// this header replaces the cookie/JWT auth other routes use) only need to survive within one
// screen's lifetime here, not across a nav stack. Closes A-023's §5 Get a Quote gap.
type Props = NativeStackScreenProps<MoreStackParamList, 'Quote'>;
type Step = 1 | 2 | 3;

interface QuoteForm {
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  size: string;
  quantity: string;
  fabric: string;
  threadColors: string;
  formatPreference: string;
  deadline: string;
  instructions: string;
}

const EMPTY_FORM: QuoteForm = { name: '', email: '', whatsapp: '', country: '', size: '', quantity: '1', fabric: '', threadColors: '', formatPreference: '', deadline: '', instructions: '' };

export function QuoteScreen({ route }: Props) {
  const preselectedSlug = route.params?.serviceSlug;
  const autoSelectedRef = useRef(false);

  const [step, setStep] = useState<Step>(1);
  const [services, setServices] = useState<MainServiceDto[] | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceSummaryDto | null>(null);
  const [questions, setQuestions] = useState<QuoteQuestionDto[] | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<QuoteForm>(EMPTY_FORM);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);

  const [messages, setMessages] = useState<QuoteMessageDto[]>([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    apiFetch<MainServiceDto[]>('/api/services')
      .then(setServices)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Could not load services.'));
  }, []);

  // AC-7/AC-11 — Service Detail's "Get a Quote" CTA passes serviceSlug, pre-selecting Step 1 and
  // jumping straight to Step 2.
  useEffect(() => {
    if (!preselectedSlug || autoSelectedRef.current || services === null) return;
    autoSelectedRef.current = true;
    const flat = services.flatMap((s) => [s as ServiceSummaryDto, ...s.subServices]);
    const match = flat.find((s) => s.slug === preselectedSlug);
    if (match) void selectService(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, preselectedSlug]);

  async function selectService(service: ServiceSummaryDto) {
    setSelectedService(service);
    setError(null);
    try {
      const list = await apiFetch<QuoteQuestionDto[]>(`/api/quote-questions?serviceId=${service.id}`);
      setQuestions(list);
      // AC-9 foundation — a draft quote is created as soon as the customer reaches this point, so
      // Step 3's embedded chat has something to attach messages to.
      const draft = await apiFetch<QuoteDto>('/api/quotes/draft', { method: 'POST', body: JSON.stringify({ serviceId: service.id }) });
      setQuote(draft);
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not start a quote for this service.');
    }
  }

  function goToStep3() {
    setStep(3);
    void loadMessages();
  }

  async function loadMessages() {
    if (!quote) return;
    try {
      const list = await apiFetch<QuoteMessageDto[]>(`/api/quotes/${quote.id}/messages`, { headers: { 'x-quote-access-token': quote.accessToken ?? '' } });
      setMessages(list);
    } catch {
      // best-effort — chat history just stays empty on failure
    }
  }

  async function sendMessage() {
    if (!quote || !chatInput.trim()) return;
    try {
      const message = await apiFetch<QuoteMessageDto>(`/api/quotes/${quote.id}/messages`, {
        method: 'POST',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body: JSON.stringify({ body: chatInput }),
      });
      setMessages((prev) => [...prev, message]);
      setChatInput('');
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not send message.');
    }
  }

  // Images only (no PDF) — expo-image-picker's library, unlike web's <input type="file">, has no
  // arbitrary-document picker; this is a documented mobile simplification, not a missing feature.
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  }

  async function onSubmit() {
    if (!quote) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body: JSON.stringify({ ...form, quantity: form.quantity ? Number(form.quantity) : undefined }),
      });

      const body = new FormData();
      if (image) {
        body.append('file', { uri: image.uri, name: image.fileName ?? 'quote-design.jpg', type: image.mimeType ?? 'image/jpeg' } as unknown as Blob);
      }
      await apiFetch(`/api/quotes/${quote.id}/submit`, {
        method: 'POST',
        headers: { 'x-quote-access-token': quote.accessToken ?? '' },
        body,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Could not submit your quote request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Quote request received</Text>
        <Text style={styles.note}>Thanks — we've got your request and typically respond within 1-2 business days. You'll receive an email confirmation shortly.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Get a Quote</Text>
      <Text style={styles.step}>Step {step} of 3</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 1 && (
        <View>
          {services === null ? (
            <ActivityIndicator style={styles.center} />
          ) : (
            services.map((main) => (
              <View key={main.id} style={styles.serviceGroup}>
                <Pressable style={styles.serviceCard} onPress={() => void selectService(main)}>
                  <Text style={styles.serviceName}>{main.name}</Text>
                  <Text style={styles.serviceDesc}>{main.description}</Text>
                </Pressable>
                {main.subServices.length > 0 && (
                  <View style={styles.subGrid}>
                    {main.subServices.map((sub) => (
                      <Pressable key={sub.id} style={styles.subChip} onPress={() => void selectService(sub)}>
                        <Text style={styles.subChipText}>{sub.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      )}

      {step === 2 && selectedService && (
        <View>
          <Text style={styles.hint}>Common questions about {selectedService.name}:</Text>
          {questions === null ? (
            <ActivityIndicator style={styles.center} />
          ) : questions.length === 0 ? (
            <Text style={styles.hint}>No common questions yet — ask us directly.</Text>
          ) : (
            questions.map((q) => (
              <Pressable key={q.id} style={styles.faqRow} onPress={() => setOpenQuestionId(openQuestionId === q.id ? null : q.id)}>
                <Text style={styles.faqQuestion}>{q.question}</Text>
                {openQuestionId === q.id && <Text style={styles.faqAnswer}>{q.answer}</Text>}
              </Pressable>
            ))
          )}
          <Pressable style={styles.button} onPress={goToStep3}>
            <Text style={styles.buttonText}>Ask a Question / Continue to Quote Form</Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View>
          <TextInput style={styles.input} placeholder="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
          <TextInput style={styles.input} placeholder="WhatsApp" value={form.whatsapp} onChangeText={(v) => setForm({ ...form, whatsapp: v })} />
          <TextInput style={styles.input} placeholder="Country" value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
          <TextInput style={styles.input} placeholder="Size" value={form.size} onChangeText={(v) => setForm({ ...form, size: v })} />
          <TextInput style={styles.input} placeholder="Quantity" keyboardType="number-pad" value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} />
          <TextInput style={styles.input} placeholder="Fabric" value={form.fabric} onChangeText={(v) => setForm({ ...form, fabric: v })} />
          <TextInput style={styles.input} placeholder="Thread colors" value={form.threadColors} onChangeText={(v) => setForm({ ...form, threadColors: v })} />
          <TextInput style={styles.input} placeholder="Machine/file format preference" value={form.formatPreference} onChangeText={(v) => setForm({ ...form, formatPreference: v })} />
          <TextInput style={styles.input} placeholder="Deadline (YYYY-MM-DD)" value={form.deadline} onChangeText={(v) => setForm({ ...form, deadline: v })} />
          <TextInput style={[styles.input, styles.multiline]} placeholder="Instructions" multiline value={form.instructions} onChangeText={(v) => setForm({ ...form, instructions: v })} />

          <Pressable style={styles.secondaryButton} onPress={pickImage}>
            <Text style={styles.secondaryButtonText}>{image ? 'Change design image' : 'Attach a design image (optional)'}</Text>
          </Pressable>

          <View style={styles.chatBox}>
            <Text style={styles.chatTitle}>Have a question before you submit?</Text>
            {messages.map((m) => (
              <Text key={m.id} style={styles.chatMessage}>
                <Text style={styles.chatSender}>{m.senderRole === 'customer' ? 'You: ' : 'Admin: '}</Text>
                {m.body}
              </Text>
            ))}
            {messages.length === 0 && <Text style={styles.hint}>No messages yet.</Text>}
            <View style={styles.chatInputRow}>
              <TextInput style={[styles.input, styles.chatInput]} placeholder="Ask a question…" value={chatInput} onChangeText={setChatInput} />
              <Pressable style={styles.chatSend} onPress={sendMessage}>
                <Text style={styles.chatSendText}>Send</Text>
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit Quote Request</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  center: { marginTop: 40, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  step: { color: '#777', marginTop: 4, marginBottom: 16 },
  note: { textAlign: 'center', color: '#555', marginTop: 12, paddingHorizontal: 16 },
  error: { color: '#c0392b', marginBottom: 12 },
  hint: { color: '#666', marginBottom: 8 },
  serviceGroup: { marginBottom: 12 },
  serviceCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 14 },
  serviceName: { fontWeight: '700' },
  serviceDesc: { color: '#666', marginTop: 4 },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 12 },
  subChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  subChipText: { fontSize: 12 },
  faqRow: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 10 },
  faqQuestion: { fontWeight: '600', color: '#1a1a2e' },
  faqAnswer: { color: '#444', marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  secondaryButton: { borderWidth: 1, borderColor: '#1a1a2e', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 16 },
  secondaryButtonText: { color: '#1a1a2e', fontWeight: '600' },
  chatBox: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 12, marginBottom: 16 },
  chatTitle: { fontWeight: '600', marginBottom: 8 },
  chatMessage: { marginBottom: 4 },
  chatSender: { fontWeight: '600' },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chatInput: { flex: 1, marginBottom: 0 },
  chatSend: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  chatSendText: { fontSize: 13 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
