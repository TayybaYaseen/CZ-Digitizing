import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';
import type { CartStackParamList } from '../navigation/types';

interface OrderDto {
  id: string;
  status: string;
  bankTransferReference: string | null;
}

// Port of apps/web/app/checkout/bank-transfer/[id]/page.tsx — shows the reference to include on
// the transfer; receipt upload is deferred (file-picker UI, same fast-follow list as other
// deferred screens) but the reference/status view itself is real.
type Props = NativeStackScreenProps<CartStackParamList, 'BankTransfer'>;

export function BankTransferScreen({ route }: Props) {
  const { accessToken } = useAuth();
  const [order, setOrder] = useState<OrderDto | null>(null);

  useEffect(() => {
    apiFetch<OrderDto>(`/api/orders/${route.params.orderId}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(setOrder)
      .catch(() => {});
  }, [route.params.orderId, accessToken]);

  if (!order) return <ActivityIndicator style={styles.center} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bank transfer instructions</Text>
      <Text>Include this reference with your transfer:</Text>
      <Text style={styles.reference}>{order.bankTransferReference}</Text>
      <Text style={styles.note}>Your order will be confirmed once payment is reviewed by our team.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  center: { marginTop: 40 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  reference: { fontSize: 22, fontWeight: '700', marginVertical: 12, color: '#1a1a2e' },
  note: { color: '#666', marginTop: 12 },
});
