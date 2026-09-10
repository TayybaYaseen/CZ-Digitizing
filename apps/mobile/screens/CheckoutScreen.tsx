import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiClientError, apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CartStackParamList } from '../navigation/types';

interface OrderDto {
  id: string;
  status: string;
  paymentMethod: string;
  bankTransferReference: string | null;
}

const PAYMENT_METHODS: { value: 'paypal' | 'bank_transfer'; label: string }[] = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

// Port of apps/web/app/checkout/page.tsx (this pass's slice: PayPal + bank-transfer per the plan's
// scope) — POST /api/cart/checkout, same {paymentMethod, creditsToApplyPkr} contract, routes to
// BankTransfer or OrderConfirmation exactly like the web page routes to their URL equivalents.
type Props = NativeStackScreenProps<CartStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'bank_transfer'>('paypal');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      const order = await apiFetch<OrderDto>('/api/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({ paymentMethod, creditsToApplyPkr: 0 }),
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (paymentMethod === 'bank_transfer') {
        navigation.replace('BankTransfer', { orderId: order.id });
      } else {
        navigation.replace('OrderConfirmation', { orderId: order.id });
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
      {PAYMENT_METHODS.map((m) => (
        <Pressable key={m.value} style={styles.option} onPress={() => setPaymentMethod(m.value)}>
          <View style={[styles.radio, paymentMethod === m.value && styles.radioSelected]} />
          <Text>{m.label}</Text>
        </Pressable>
      ))}
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
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#999', marginRight: 10 },
  radioSelected: { borderColor: '#1a1a2e', backgroundColor: '#1a1a2e' },
  error: { color: '#c0392b', marginVertical: 12 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
