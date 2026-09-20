import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CartStackParamList } from '../navigation/types';

interface OrderDto {
  id: string;
  status: string;
  paymentStatus: string;
  amountDuePkr: number;
  bankTransferReference: string | null;
}

// Port of apps/web/app/checkout/page.tsx — POST /api/cart/checkout. BANK TRANSFER is the only payment
// method, so there is nothing to choose: the order is created and the customer is taken to the bank
// details + receipt upload (BankTransfer), or straight to the confirmation if credits covered it all.
type Props = NativeStackScreenProps<CartStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const order = await apiFetch<OrderDto>('/api/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'bank_transfer', creditsToApplyPkr: 0 }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (order.paymentStatus === 'completed') {
        navigation.replace('OrderConfirmation', { orderId: order.id });
      } else {
        navigation.replace('BankTransfer', { orderId: order.id });
      }
    } catch (e) {
      setError(e instanceof ApiClientError ? e.error.message : 'Checkout failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment method</Text>
      <Text style={styles.method}>Bank Transfer</Text>
      <Text style={styles.note}>Transfer the exact amount to the bank account shown on the next step and upload your payment receipt.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onConfirm} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Place order</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  method: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  note: { color: '#555' },
  error: { color: '#c0392b', marginVertical: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
