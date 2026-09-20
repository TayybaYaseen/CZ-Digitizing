import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CartStackParamList } from '../navigation/types';

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  totalPkr: number;
  amountDuePkr: number;
  amountPaidPkr: number;
  amountOutstandingPkr: number;
  creditsUsed: number;
  bankTransferReference: string | null;
  receipts: { id: string; reviewStatus: string; rejectionReason: string | null }[];
}

interface BankConfig {
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  instructions?: string;
}

// Exact PKR amount, never converted ("PKR 1,500", "PKR 1,500.50").
function formatPkr(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0;
  return `PKR ${rounded.toLocaleString('en-US', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// Port of apps/web/app/checkout/bank-transfer/[id]/page.tsx — the ONLY payment screen (bank transfer is
// the only payment method): the exact PKR amount, the bank details Admin configured in Settings (read
// live from GET /api/settings/public, never hardcoded), the order reference, and the receipt upload.
// A rejected receipt shows Admin's reason and asks for a new one. Only an Admin approving the receipt
// confirms the order — nothing on this screen can.
type Props = NativeStackScreenProps<CartStackParamList, 'BankTransfer'>;

export function BankTransferScreen({ route, navigation }: Props) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [bank, setBank] = useState<BankConfig | null>(null);
  const [bankLoaded, setBankLoaded] = useState(false);
  const [bankFailed, setBankFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    apiFetch<OrderDto>(`/api/orders/${route.params.orderId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiClientError ? e.error.message : 'Could not load the order.'));
    apiFetch<{ bankTransferConfig: BankConfig | null }>('/api/settings/public')
      .then((s) => setBank(s.bankTransferConfig ?? null))
      .catch(() => setBankFailed(true))
      .finally(() => setBankLoaded(true));
  }, [route.params.orderId, accessToken]);

  useEffect(load, [load]);

  // Already paid (e.g. credits covered the whole order): nothing to transfer, no receipt to upload.
  useEffect(() => {
    if (order?.paymentStatus === 'completed') navigation.replace('OrderConfirmation', { orderId: order.id });
  }, [order, navigation]);

  async function uploadReceipt() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', { uri: asset.uri, name: asset.fileName ?? 'receipt.jpg', type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
      await apiFetch(`/api/orders/${route.params.orderId}/receipt`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body });
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Receipt upload failed.');
    } finally {
      setUploading(false);
    }
  }

  if (!order) return error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={styles.center} />;
  if (order.paymentStatus === 'completed') return null; // redirecting to the confirmation

  const latest = order.receipts[0];
  const awaitingReview = latest?.reviewStatus === 'pending';
  const closed = order.status !== 'payment_pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Bank Transfer</Text>
      <Text>Transfer the exact amount to the bank account below and upload your payment receipt.</Text>
      <Text style={styles.amount}>Amount to transfer: {formatPkr(order.amountOutstandingPkr)}</Text>
      {order.amountPaidPkr > 0 ? (
        <Text style={styles.note}>
          {formatPkr(order.amountPaidPkr)} of your payment has been confirmed so far. Your files unlock only once the full amount has been paid and confirmed.
        </Text>
      ) : null}
      {order.creditsUsed > 0 ? (
        <Text style={styles.note}>
          (Order total {formatPkr(order.totalPkr)}, of which {formatPkr(order.creditsUsed)} was paid with credits.)
        </Text>
      ) : null}

      {bankFailed ? (
        <Text style={styles.warning}>We couldn&apos;t load the bank account details. Please try again before sending any payment.</Text>
      ) : !bankLoaded ? (
        <ActivityIndicator />
      ) : bank ? (
        <View style={styles.box}>
          {bank.bankName ? <Text>Bank: {bank.bankName}</Text> : null}
          {bank.accountTitle ? <Text>Account title: {bank.accountTitle}</Text> : null}
          {bank.accountNumber ? <Text>Account number: {bank.accountNumber}</Text> : null}
          {bank.iban ? <Text>IBAN: {bank.iban}</Text> : null}
          {bank.instructions ? <Text style={styles.note}>{bank.instructions}</Text> : null}
        </View>
      ) : (
        <Text style={styles.warning}>Bank transfer account details aren&apos;t available yet. Please contact support before sending payment.</Text>
      )}

      <Text>Include this reference with your transfer:</Text>
      <Text style={styles.reference}>{order.bankTransferReference}</Text>

      {latest?.reviewStatus === 'rejected' ? (
        <View style={styles.rejected}>
          <Text style={styles.rejectedTitle}>Your payment receipt was rejected — a new receipt is required.</Text>
          {latest.rejectionReason ? <Text style={styles.rejectedText}>Reason: {latest.rejectionReason}</Text> : null}
          <Text style={styles.rejectedText}>Please check the amount and reference, then upload a new receipt.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {closed ? (
        <Text style={styles.note}>This order is &quot;{order.status}&quot; and no longer accepts a payment receipt.</Text>
      ) : awaitingReview ? (
        <Text style={styles.success}>Receipt received. Our team will review it shortly and you&apos;ll be notified once payment is confirmed.</Text>
      ) : (
        <Pressable style={styles.button} onPress={uploadReceipt} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{latest?.reviewStatus === 'rejected' ? 'Upload a new receipt' : 'Upload payment receipt'}</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, gap: 10 },
  center: { marginTop: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  amount: { fontSize: 18, fontWeight: '700', color: '#1a1a2e', marginTop: 8 },
  box: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, gap: 4 },
  reference: { fontSize: 22, fontWeight: '700', color: '#1a1a2e' },
  note: { color: '#666' },
  warning: { color: '#92400e', backgroundColor: '#fef3c7', padding: 10, borderRadius: 6 },
  rejected: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  rejectedTitle: { color: '#b91c1c', fontWeight: '700' },
  rejectedText: { color: '#b91c1c' },
  success: { color: '#047857' },
  error: { color: '#c0392b', marginVertical: 8 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
